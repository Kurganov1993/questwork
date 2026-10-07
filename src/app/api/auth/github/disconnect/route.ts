import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { githubAccounts } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';

export const runtime = 'nodejs';

export async function POST() {
  const hero = await getCurrentHero();
  if (!hero) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
  }

  try {
    await withRetry(
      () =>
        db
          .delete(githubAccounts)
          .where(eq(githubAccounts.heroId, hero.id)),
      { label: 'github:disconnect' },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[github/disconnect]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}