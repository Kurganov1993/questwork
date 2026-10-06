import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { githubAccounts } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { fetchUserRepos } from '@/lib/github-oauth';
import { withRetry } from '@/lib/db-retry';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const hero = await getCurrentHero();
    if (!hero) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    let account: typeof githubAccounts.$inferSelect | undefined;
    try {
      const rows = await withRetry(
        () =>
          db
            .select()
            .from(githubAccounts)
            .where(eq(githubAccounts.heroId, hero.id)),
        { label: 'github:repos-account' },
      );
      account = rows[0];
    } catch (e) {
      console.error('[github/repos] db failed:', (e as Error).message);
      return NextResponse.json(
        { ok: false, error: 'База данных недоступна' },
        { status: 503 },
      );
    }

    if (!account) {
      return NextResponse.json(
        { ok: false, error: 'not_connected' },
        { status: 404 },
      );
    }

    const repos = await fetchUserRepos(account.accessToken);

    return NextResponse.json({ ok: true, repos });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const cause = err.cause as Error | undefined;
    const detail = cause
      ? `${err.message}: ${cause.message}`
      : err.message;

    console.error('[github/repos]', detail);

    return NextResponse.json(
      { ok: false, error: detail.slice(0, 200) },
      { status: 500 },
    );
  }
}