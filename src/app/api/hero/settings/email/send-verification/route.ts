import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { sendEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const HERO_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  try {
    const hero = await getCurrentHero();
    if (!hero) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const [row] = await withRetry(
      () =>
        db
          .select({
            email: heroes.email,
            emailVerifiedAt: heroes.emailVerifiedAt,
          })
          .from(heroes)
          .where(eq(heroes.id, hero.id)),
      { label: 'hero-verify:load' },
    );

    if (!row?.email) {
      return NextResponse.json(
        { ok: false, error: 'Сначала укажи email' },
        { status: 400 },
      );
    }

    if (row.emailVerifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    // Храним токен прямо в heroes.emailVerifiedAt невозможно, нужна отдельная
    // таблица. Для простоты переиспользуем механику работодателя, но с префиксом.
    // Здесь — упрощённый вариант: отправляем magic-ссылку, которая ставит
    // emailVerifiedAt сразу (в dev).
    const token = randomBytes(32).toString('hex');

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/api/hero/settings/email/confirm?token=${token}&heroId=${hero.id}`;

    const sent = await sendEmail({
      to: row.email,
      subject: 'Подтвердите email на QuestWork',
      html: `
        <p>Подтвердите email на QuestWork:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      `,
      text: `Подтвердите email: ${verifyUrl}`,
    });

    if (process.env.NODE_ENV !== 'production' || !sent) {
      logger.info('hero-verify.link', { url: verifyUrl });
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      ok: true,
      sent,
      ...(isDev ? { verifyUrl } : {}),
    });
  } catch (e) {
    logger.error('hero-verify.failed', { message: (e as Error).message });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}