import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { heroes, sessions } from '@/db/schema';
import { withRetry } from './db-retry';
import { logger } from './logger';

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = 'qw_session';
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

// ---------- Пароли ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(key, 'hex');
  if (keyBuf.length !== buf.length) return false;
  return timingSafeEqual(buf, keyBuf);
}

// ---------- Сессии ----------

export async function createSession(heroId: number): Promise<string> {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await withRetry(
    () => db.insert(sessions).values({ id, heroId, expiresAt }),
    { label: 'auth:create-session' },
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });

  return id;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) {
    await withRetry(
      () => db.delete(sessions).where(eq(sessions.id, id)),
      { label: 'auth:destroy-session' },
    ).catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

export type CurrentHero = {
  id: number;
  nickname: string;
  heroClass:
    | 'frontend_mage'
    | 'backend_warrior'
    | 'devops_paladin'
    | 'qa_rogue'
    | 'designer_bard'
    | 'pm_druid';
  level: number;
  xp: number;
  gold: number;
};

export async function getCurrentHero(): Promise<CurrentHero | null> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  let rows: {
    hero: typeof heroes.$inferSelect;
    session: typeof sessions.$inferSelect;
  }[];

  try {
    rows = await withRetry(
      () =>
        db
          .select({
            hero: heroes,
            session: sessions,
          })
          .from(sessions)
          .innerJoin(heroes, eq(heroes.id, sessions.heroId))
          .where(eq(sessions.id, sessionId))
          .limit(1),
      { label: 'auth:get-current-hero' },
    );
  } catch (e) {
    logger.error('auth.getCurrentHero.failed', {
      message: (e as Error).message,
    });
    return null;
  }

  const row = rows[0];
  if (!row) return null;

  if (row.session.expiresAt.getTime() < Date.now()) {
    await withRetry(
      () => db.delete(sessions).where(eq(sessions.id, sessionId)),
      { label: 'auth:delete-expired' },
    ).catch(() => {});
    return null;
  }

  return {
    id: row.hero.id,
    nickname: row.hero.nickname,
    heroClass: row.hero.heroClass,
    level: row.hero.level,
    xp: row.hero.xp,
    gold: row.hero.gold,
  };
}

// ---------- Валидация ----------

export function validateNickname(nickname: string): string | null {
  const n = nickname.trim();
  if (n.length < 3) return 'Ник должен быть не короче 3 символов';
  if (n.length > 32) return 'Ник должен быть не длиннее 32 символов';
  if (!/^[a-zA-Z0-9_-]+$/.test(n)) return 'Только латиница, цифры, _ и -';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Пароль должен быть не короче 6 символов';
  if (password.length > 128) return 'Пароль слишком длинный';
  return null;
}