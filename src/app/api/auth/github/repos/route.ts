import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { githubAccounts } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { fetchUserRepos } from '@/lib/github-oauth';
import { withRetry } from '@/lib/db-retry';

export const runtime = 'nodejs';

export async function GET() {
  const hero = await getCurrentHero();
  if (!hero) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
  }

  const [account] = await withRetry(
    () =>
      db
        .select()
        .from(githubAccounts)
        .where(eq(githubAccounts.heroId, hero.id)),
    { label: 'github:get-account' },
  ).catch(() => []);

  if (!account) {
    return NextResponse.json(
      { ok: false, error: 'not_connected' },
      { status: 404 },
    );
  }

  try {
    const repos = await fetchUserRepos(account.accessToken);
    return NextResponse.json({ ok: true, repos });
  } catch (e) {
    console.error('[github/repos]', e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message.slice(0, 100) },
      { status: 500 },
    );
  }
}