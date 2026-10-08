import { NextResponse } from 'next/server';
import { getCurrentHero } from '@/lib/auth';
import { markAllSeen } from '@/lib/notifications';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST() {
  const hero = await getCurrentHero();
  if (!hero)
    return NextResponse.json(
      { ok: false, error: 'Не авторизован' },
      { status: 401 },
    );

  const rl = await checkRateLimit('notifications', `hero:${hero.id}`);
  if (!rl.allowed) return rateLimitResponse(rl);

  const ok = await markAllSeen(hero.id);
  return NextResponse.json({ ok });
}