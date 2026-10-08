import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import {
  getCurrentHero,
  verifyPassword,
  destroyCurrentSession,
} from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { reportError } from '@/lib/error-reporting';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const hero = await getCurrentHero();
    if (!hero) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const rl = await checkRateLimit('accountDelete', `hero:${hero.id}`);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => ({}));
    const password = String(body.password ?? '');
    const confirmText = String(body.confirmText ?? '').trim().toLowerCase();

    if (!password) {
      return NextResponse.json(
        { ok: false, error: 'Введи пароль для подтверждения' },
        { status: 400 },
      );
    }

    if (confirmText !== 'удалить мой аккаунт') {
      return NextResponse.json(
        { ok: false, error: 'Текст подтверждения введён неверно' },
        { status: 400 },
      );
    }

    const [row] = await withRetry(
      () =>
        db
          .select({ passwordHash: heroes.passwordHash })
          .from(heroes)
          .where(eq(heroes.id, hero.id)),
      { label: 'hero-delete:load-hash' },
    );

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'Герой не найден' },
        { status: 404 },
      );
    }

    const ok = await verifyPassword(password, row.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: 'Неверный пароль' },
        { status: 401 },
      );
    }

    await withRetry(() => db.delete(heroes).where(eq(heroes.id, hero.id)), {
      label: 'hero-delete:delete',
    });

    await destroyCurrentSession();

    logger.info('hero.deleted', {
      heroId: hero.id,
      nickname: hero.nickname,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await reportError(e, {
      tags: { route: 'api/hero/delete' },
    });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}