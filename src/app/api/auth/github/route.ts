import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getCurrentHero } from '@/lib/auth';
import { getAuthorizeUrl, isGithubOAuthConfigured } from '@/lib/github-oauth';

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

  const state = randomBytes(16).toString('hex');

  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 минут
    secure: process.env.NODE_ENV === 'production',
  });

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = `${origin}/api/auth/github/callback`;

  return NextResponse.redirect(getAuthorizeUrl(state, redirectUri));
}