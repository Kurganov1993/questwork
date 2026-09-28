import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers, customerSessions } from '@/db/schema';

const scryptAsync = promisify(scrypt);

const COOKIE = 'qw_employer_session';
const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(key, 'hex');
  if (keyBuf.length !== buf.length) return false;
  return timingSafeEqual(buf, keyBuf);
}

export async function createCustomerSession(customerId: number): Promise<string> {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.insert(customerSessions).values({ id, customerId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });

  return id;
}

export async function destroyCustomerSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    await db.delete(customerSessions).where(eq(customerSessions.id, id)).catch(() => {});
  }
  jar.delete(COOKIE);
}

export type CurrentCustomer = {
  id: number;
  email: string;
  companyName: string;
  slug: string;
};

export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const jar = await cookies();
  const sessionId = jar.get(COOKIE)?.value;
  if (!sessionId) return null;

  const rows = await db
    .select({ customer: customers, session: customerSessions })
    .from(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(eq(customerSessions.id, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.session.expiresAt.getTime() < Date.now()) {
    await db
      .delete(customerSessions)
      .where(eq(customerSessions.id, sessionId))
      .catch(() => {});
    return null;
  }

  return {
    id: row.customer.id,
    email: row.customer.email,
    companyName: row.customer.companyName,
    slug: row.customer.slug,
  };
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Некорректный email';
  return null;
}

export function validateCompanyName(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return 'Название компании слишком короткое';
  if (n.length > 128) return 'Название компании слишком длинное';
  return null;
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

export function slugify(input: string): string {
  const transliterated = input
    .toLowerCase()
    .trim()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('');

  return transliterated
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}