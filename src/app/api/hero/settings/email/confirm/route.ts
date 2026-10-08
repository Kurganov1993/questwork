import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { withRetry } from '@/lib/db-retry';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const heroId = Number(searchParams.get('heroId'));

  if (!Number.isFinite(heroId) || heroId <= 0) {
    return NextResponse.redirect(
      new URL('/hero/settings?verify=error', req.url),
    );
  }

  try {
    await withRetry(
      () =>
        db
          .update(heroes)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(heroes.id, heroId)),
      { label: 'hero-verify:confirm' },
    );

    logger.info('hero.email.verified', { heroId });

    return NextResponse.redirect(
      new URL('/hero/settings?verify=success', req.url),
    );
  } catch (e) {
    logger.error('hero-verify.confirm.failed', {
      message: (e as Error).message,
    });
    return NextResponse.redirect(
      new URL('/hero/settings?verify=error', req.url),
    );
  }
}