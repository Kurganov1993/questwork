import { NextRequest, NextResponse } from 'next/server';
import {
  validateResetToken,
  applyPasswordReset,
} from '@/lib/password-reset';
import { validatePassword } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req);
    const rl = await checkRateLimit('auth', identifier);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const token = String(body.token ?? '').trim();
    const password = String(body.password ?? '');

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { ok: false, error: 'Неверный токен' },
        { status: 400 },
      );
    }

    const passwordErr = validatePassword(password);
    if (passwordErr) {
      return NextResponse.json(
        { ok: false, error: passwordErr },
        { status: 400 },
      );
    }

    const validation = await validateResetToken(token);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.reason },
        { status: 400 },
      );
    }

    const applied = await applyPasswordReset(
      token,
      password,
      validation.subject,
    );

    if (!applied) {
      return NextResponse.json(
        { ok: false, error: 'Не удалось сбросить пароль' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('reset-password.failed', {
      message: (e as Error).message,
    });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}