import { getCurrentHero } from './auth';

export function isAdminHeroId(heroId: number): boolean {
  const adminId = Number(process.env.ADMIN_HERO_ID ?? 0);
  return adminId > 0 && heroId === adminId;
}

export async function requireAdmin(): Promise<
  | { ok: true; heroId: number; nickname: string }
  | { ok: false }
> {
  const hero = await getCurrentHero();
  if (!hero) return { ok: false };
  if (!isAdminHeroId(hero.id)) return { ok: false };
  return { ok: true, heroId: hero.id, nickname: hero.nickname };
}