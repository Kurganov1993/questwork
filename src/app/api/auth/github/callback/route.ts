import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { githubAccounts } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import {
  exchangeCodeForToken,
  fetchGithubUser,
  isGithubOAuthConfigured,
} from '@/lib/github-oauth';
import { encryptToken } from '@/lib/crypto';
import { withRetry } from '@/lib/db-retry';

export const runtime = 'nodejs';

const STATE_COOKIE = 'qw_gh_state';

export async function GET(req: NextRequest) {
  const hero = await getCurrentHero();
  if (!hero) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (!isGithubOAuthConfigured()) {
    return NextResponse.redirect(
      new URL('/hero/github?error=oauth_not_configured', req.url),
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/hero/github?error=${encodeURIComponent(error)}`, req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/hero/github?error=missing_params', req.url),
    );
  }

  // Проверяем CSRF-токен
  const jar = await cookies();
  const savedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL('/hero/github?error=state_mismatch', req.url),
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = `${origin}/api/auth/github/callback`;

  try {
    const accessToken = await exchangeCodeForToken(code, redirectUri);
    const ghUser = await fetchGithubUser(accessToken);

    // Шифруем токен перед сохранением
    const encryptedToken = encryptToken(accessToken);

    await withRetry(
      () =>
        db
          .insert(githubAccounts)
          .values({
            heroId: hero.id,
            githubId: String(ghUser.id),
            githubUsername: ghUser.login,
            accessToken: encryptedToken,
            avatarUrl: ghUser.avatar_url,
          })
          .onConflictDoUpdate({
            target: githubAccounts.heroId,
            set: {
              githubId: String(ghUser.id),
              githubUsername: ghUser.login,
              accessToken: encryptedToken,
              avatarUrl: ghUser.avatar_url,
            },
          }),
      { label: 'github:save-account' },
    );

    return NextResponse.redirect(
      new URL('/hero/github?connected=1', req.url),
    );
  } catch (e) {
    console.error('[github/callback]', e);
    const msg = encodeURIComponent((e as Error).message.slice(0, 100));
    return NextResponse.redirect(
      new URL(`/hero/github?error=${msg}`, req.url),
    );
  }
}