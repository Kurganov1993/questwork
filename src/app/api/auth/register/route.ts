import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createSession,
  hashPassword,
  validateNickname,
  validatePassword,
} from '@/lib/auth';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';

const HERO_CLASSES = [
  'frontend_mage',
  'backend_warrior',
  'devops_paladin',
  'qa_rogue',
  'designer_bard',
  'pm_druid',
] as const;

type HeroClass = (typeof HERO_CLASSES)[number];

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req);
    const rl = await checkRateLimit('auth', identifier);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const nicknameRaw = String(body.nickname ?? '').trim();
    const password = String(body.password ?? '');
    const heroClass = body.heroClass as HeroClass;
    const acceptedTerms = body.acceptedTerms === true;

    if (!acceptedTerms) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Необходимо принять Пользовательское соглашение и Политику конфиденциальности',
        },
        { status: 400 },
      );
    }

    const nicknameErr = validateNickname(nicknameRaw);
    if (nicknameErr)
      return NextResponse.json(
        { ok: false, error: nicknameErr },
        { status: 400 },
      );

    const passwordErr = validatePassword(password);
    if (passwordErr)
      return NextResponse.json(
        { ok: false, error: passwordErr },
        { status: 400 },
      );

    if (!HERO_CLASSES.includes(heroClass))
      return NextResponse.json(
        { ok: false, error: 'Неверный класс героя' },
        { status: 400 },
      );

    const [existing] = await db
      .select({ id: heroes.id })
      .from(heroes)
      .where(eq(heroes.nickname, nicknameRaw));

    if (existing)
      return NextResponse.json(
        { ok: false, error: 'Этот ник уже занят' },
        { status: 409 },
      );

    const passwordHash = await hashPassword(password);

    const [created] = await db
      .insert(heroes)
      .values({
        nickname: nicknameRaw,
        passwordHash,
        heroClass,
        termsAcceptedAt: new Date(),
      })
      .returning();

    await createSession(created.id);

    return NextResponse.json({
      ok: true,
      hero: { id: created.id, nickname: created.nickname },
    });
  } catch (e) {
    console.error('[auth/register]', e);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}