import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  findSubjectByEmail,
  createResetToken,
} from '@/lib/password-reset';
import { sendEmail, resetPasswordEmailHtml } from '@/lib/email';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { withRetry } from '@/lib/db-retry';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req);
    // Жёсткий лимит — 5 попыток в час с одного IP
    const rl = await checkRateLimit('auth', identifier);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'Некорректный email' },
        { status: 400 },
      );
    }

    // Всегда возвращаем 200, чтобы не палить существование аккаунта
    const subject = await findSubjectByEmail(email);

    if (!subject) {
      logger.info('reset.request.unknown-email', { email });
      return NextResponse.json({ ok: true });
    }

    // Проверяем: у героя email должен быть подтверждён
    if (subject.kind === 'hero') {
      const [hero] = await withRetry(
        () =>
          db
            .select({ emailVerifiedAt: heroes.emailVerifiedAt })
            .from(heroes)
            .where(eq(heroes.id, subject.id)),
        { label: 'reset:check-hero-verify' },
      );

      if (!hero?.emailVerifiedAt) {
        logger.info('reset.request.unverified', { heroId: subject.id });
        // Не даём сбросить пароль через неподтверждённый email
        return NextResponse.json({ ok: true });
      }
    }

    const token = await createResetToken(subject);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const sent = await sendEmail({
      to: subject.email,
      subject: 'Сброс пароля на QuestWork',
      html: resetPasswordEmailHtml({
        name: subject.name,
        resetUrl,
        isCustomer: subject.kind === 'customer',
      }),
      text: `Сброс пароля: ${resetUrl}`,
    });

    if (process.env.NODE_ENV !== 'production' || !sent) {
      logger.info('reset.link', { email: subject.email, url: resetUrl });
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      ok: true,
      ...(isDev ? { resetUrl } : {}),
    });
  } catch (e) {
    logger.error('forgot-password.failed', {
      message: (e as Error).message,
    });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}