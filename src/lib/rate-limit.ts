import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { rateLimits } from '@/db/schema';

export type RateLimitConfig = {
  bucket: string;
  limit: number;
  windowSec: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
  limit: number;
};

const PRESETS: Record<string, RateLimitConfig> = {
  verify: { bucket: 'verify', limit: 10, windowSec: 3600 },
  auth: { bucket: 'auth', limit: 20, windowSec: 900 },
  employerAuth: { bucket: 'employer-auth', limit: 20, windowSec: 900 },
  employerCreate: { bucket: 'employer-create', limit: 30, windowSec: 3600 },
  submissionStatus: { bucket: 'submission-status', limit: 100, windowSec: 3600 },
  cataRun: { bucket: 'cata-run', limit: 60, windowSec: 3600 },
  githubOAuth: { bucket: 'github-oauth', limit: 10, windowSec: 3600 },
  githubRepos: { bucket: 'github-repos', limit: 60, windowSec: 3600 },
  notifications: { bucket: 'notifications', limit: 120, windowSec: 3600 },
  accountDelete: { bucket: 'account-delete', limit: 3, windowSec: 3600 },
};

let lastCleanup = 0;

async function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 10 * 60 * 1000) return;
  lastCleanup = now;

  try {
    await db.execute(sql`
      DELETE FROM rate_limits
      WHERE updated_at < now() - interval '1 day'
    `);
  } catch (e) {
    console.error('[rate-limit] cleanup failed:', (e as Error).message);
  }
}

export async function checkRateLimit(
  configKey: keyof typeof PRESETS,
  identifier: string,
): Promise<RateLimitResult> {
  const config = PRESETS[configKey];
  if (!config) {
    return {
      allowed: true,
      remaining: 999,
      resetInSec: 0,
      limit: 999,
    };
  }

  void maybeCleanup();

  const { bucket, limit, windowSec } = config;
  const key = identifier.slice(0, 128);

  try {
    const [row] = await db
      .select()
      .from(rateLimits)
      .where(and(eq(rateLimits.bucket, bucket), eq(rateLimits.key, key)));

    const now = new Date();

    if (!row) {
      await db.insert(rateLimits).values({
        bucket,
        key,
        count: 1,
        windowStart: now,
        updatedAt: now,
      });
      return {
        allowed: true,
        remaining: limit - 1,
        resetInSec: windowSec,
        limit,
      };
    }

    const elapsedSec = (now.getTime() - row.windowStart.getTime()) / 1000;

    if (elapsedSec >= windowSec) {
      await db
        .update(rateLimits)
        .set({
          count: 1,
          windowStart: now,
          updatedAt: now,
        })
        .where(eq(rateLimits.id, row.id));

      return {
        allowed: true,
        remaining: limit - 1,
        resetInSec: windowSec,
        limit,
      };
    }

    if (row.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetInSec: Math.ceil(windowSec - elapsedSec),
        limit,
      };
    }

    await db
      .update(rateLimits)
      .set({
        count: sql`${rateLimits.count} + 1`,
        updatedAt: now,
      })
      .where(eq(rateLimits.id, row.id));

    return {
      allowed: true,
      remaining: limit - row.count - 1,
      resetInSec: Math.ceil(windowSec - elapsedSec),
      limit,
    };
  } catch (e) {
    console.error('[rate-limit] check failed:', (e as Error).message);
    return {
      allowed: true,
      remaining: 1,
      resetInSec: 0,
      limit,
    };
  }
}

export function getClientIdentifier(
  req: Request,
  heroId?: number,
): string {
  if (heroId) return `hero:${heroId}`;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return `ip:${ip}`;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return `ip:${realIp}`;

  return 'ip:unknown';
}

export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: `Слишком много запросов. Попробуй через ${Math.ceil(
        result.resetInSec / 60,
      )} мин.`,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.resetInSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(
          Math.floor(Date.now() / 1000) + result.resetInSec,
        ),
      },
    },
  );
}