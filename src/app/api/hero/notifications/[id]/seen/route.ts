import { NextRequest, NextResponse } from 'next/server';
import { getCurrentHero } from '@/lib/auth';
import { markNotificationSeen } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const hero = await getCurrentHero();
  if (!hero)
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const subId = Number(id);
  if (!Number.isFinite(subId))
    return NextResponse.json({ ok: false, error: 'Неверный id' }, { status: 400 });

  const ok = await markNotificationSeen(hero.id, subId);
  return NextResponse.json({ ok });
}