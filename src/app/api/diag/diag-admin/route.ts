import { NextResponse } from 'next/server';
import { getCurrentHero } from '@/lib/auth';
import { isAdminHeroId } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const hero = await getCurrentHero();
  const adminId = process.env.ADMIN_HERO_ID ?? null;
  const adminNum = Number(adminId ?? 0);

  return NextResponse.json({
    envAdminId: adminId,
    envAdminNum: adminNum,
    hero: hero
      ? { id: hero.id, nickname: hero.nickname }
      : null,
    isAdmin: hero ? isAdminHeroId(hero.id) : false,
    match: hero ? hero.id === adminNum : false,
  });
}