import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createSession, verifyPassword } from '@/lib/auth';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req);
    const rl = await checkRateLimit('auth', identifier);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const body = await req.json();
    const nickname = String(body.nickname ?? '').trim();
    const password = String(body.password ?? '');

    if (!nickname || !password) {
      return NextResponse.json(
        { ok: false, error: 'Ник и пароль обязательны' },
        { status: 400 },
      );
    }

    const [hero] = await db
      .select()
      .from(heroes)
      .where(eq(heroes.nickname, nickname));

    if (!hero) {
      return NextResponse.json(
        { ok: false, error: 'Неверный ник или пароль' },
        { status: 401 },
      );
    }

    const okPass = await verifyPassword(password, hero.passwordHash);
    if (!okPass) {
      return NextResponse.json(
        { ok: false, error: 'Неверный ник или пароль' },
        { status: 401 },
      );
    }

    await createSession(hero.id);

    return NextResponse.json({
      ok: true,
      hero: { id: hero.id, nickname: hero.nickname },
    });
  } catch (e) {
    console.error('[auth/login]', e);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}