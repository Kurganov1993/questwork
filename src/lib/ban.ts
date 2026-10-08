import { db } from '@/db';
import { bannedIps } from '@/db/schema';
import { eq, and, or, isNull, gt } from 'drizzle-orm';
import { withRetry } from './db-retry';
import { hashIp } from './analytics';
import { logger } from './logger';

export async function isIpBanned(ip: string): Promise<boolean> {
  if (!ip || ip === 'unknown') return false;

  try {
    const ipHash = hashIp(ip);

    const rows = await withRetry(
      () =>
        db
          .select({ id: bannedIps.id })
          .from(bannedIps)
          .where(
            and(
              eq(bannedIps.ipHash, ipHash),
              or(isNull(bannedIps.expiresAt), gt(bannedIps.expiresAt, new Date())),
            ),
          )
          .limit(1),
      { label: 'ban:check' },
    );

    return rows.length > 0;
  } catch (e) {
    logger.warn('ban.check.failed', { message: (e as Error).message });
    return false;
  }
}

export async function banIp(
  ip: string,
  reason: string,
  ttlHours?: number,
): Promise<boolean> {
  try {
    const ipHash = hashIp(ip);
    const expiresAt = ttlHours
      ? new Date(Date.now() + ttlHours * 60 * 60 * 1000)
      : null;

    await withRetry(
      () =>
        db
          .insert(bannedIps)
          .values({ ipHash, reason, expiresAt })
          .onConflictDoUpdate({
            target: bannedIps.ipHash,
            set: { reason, expiresAt, createdAt: new Date() },
          }),
      { label: 'ban:insert' },
    );

    logger.info('ban.created', { ipHash, reason, ttlHours });
    return true;
  } catch (e) {
    logger.error('ban.create.failed', { message: (e as Error).message });
    return false;
  }
}

export async function unbanIp(ip: string): Promise<boolean> {
  try {
    const ipHash = hashIp(ip);
    await withRetry(
      () => db.delete(bannedIps).where(eq(bannedIps.ipHash, ipHash)),
      { label: 'ban:delete' },
    );
    return true;
  } catch {
    return false;
  }
}