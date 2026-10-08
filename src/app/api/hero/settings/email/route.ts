import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function PATCH(req: NextRequest) {
  try {
    const hero = await getCurrentHero();
    if (!hero) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const notifyByEmail = body.notifyByEmail;
    const email = body.email ? String(body.email).trim().toLowerCase() : undefined;

    const update: Partial<typeof heroes.$inferInsert> = {};

    if (typeof notifyByEmail === 'boolean') {
      update.notifyByEmail = notifyByEmail;
    }

    if (email !== undefined) {
      if (email === '') {
        update.email = null;
        update.emailVerifiedAt = null;
      } else if (isValidEmail(email)) {
        update.email = email;
        // Сброс верификации — теперь нужен новый токен.
        // Для простоты: emailVerification удаляется, ставим null.
        update.emailVerifiedAt = null;
      } else {
        return NextResponse.json(
          { ok: false, error: 'Неверный формат email' },
          { status: 400 },
        );
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true });
    }

    await withRetry(
      () => db.update(heroes).set(update).where(eq(heroes.id, hero.id)),
      { label: 'hero-settings:update' },
    );

    logger.info('hero.settings.updated', {
      heroId: hero.id,
      fields: Object.keys(update),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('hero-settings.failed', { message: (e as Error).message });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}