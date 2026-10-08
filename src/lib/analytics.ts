import { createHash } from 'node:crypto';
import { db } from '@/db';
import { pageViews } from '@/db/schema';
import { sql, gte, desc } from 'drizzle-orm';
import { logger } from './logger';

const IP_SALT =
  process.env.ANALYTICS_IP_SALT ?? 'questwork-default-salt-change-me';

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip + IP_SALT).digest('hex').slice(0, 32);
}

export function extractIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  const real = headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

/**
 * Фильтр нежелательных путей. Не считаем админку, API и статику.
 */
export function shouldTrack(path: string): boolean {
  if (path.startsWith('/api/')) return false;
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/_next')) return false;
  if (path.startsWith('/favicon')) return false;
  if (/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2)$/i.test(path))
    return false;
  return true;
}

export type TrackInput = {
  path: string;
  referrer: string | null;
  userAgent: string | null;
  ip: string;
  heroId?: number;
  sessionId?: string;
};

export async function recordPageView(input: TrackInput): Promise<void> {
  try {
    await db.insert(pageViews).values({
      path: input.path.slice(0, 512),
      referrer: input.referrer?.slice(0, 512) ?? null,
      userAgent: input.userAgent?.slice(0, 1000) ?? null,
      ipHash: hashIp(input.ip),
      heroId: input.heroId ?? null,
      sessionId: input.sessionId ?? null,
    });
  } catch (e) {
    // Никогда не падаем из-за метрики
    logger.warn('analytics.record.failed', {
      message: (e as Error).message,
    });
  }
}

// ============================================================
// Чтение для админки
// ============================================================

export type AnalyticsSummary = {
  today: { views: number; unique: number };
  last7d: { views: number; unique: number };
  last30d: { views: number; unique: number };
};

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const empty = {
    today: { views: 0, unique: 0 },
    last7d: { views: 0, unique: 0 },
    last30d: { views: 0, unique: 0 },
  };

  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const query = (since: Date) =>
      db
        .select({
          views: sql<number>`count(*)::int`,
          unique: sql<number>`count(distinct ${pageViews.ipHash})::int`,
        })
        .from(pageViews)
        .where(gte(pageViews.createdAt, since))
        .then((r) => ({
          views: Number(r[0]?.views ?? 0),
          unique: Number(r[0]?.unique ?? 0),
        }));

    const [today, last7d, last30d] = await Promise.all([
      query(todayStart),
      query(weekAgo),
      query(monthAgo),
    ]);

    return { today, last7d, last30d };
  } catch (e) {
    logger.warn('analytics.summary.failed', {
      message: (e as Error).message,
    });
    return empty;
  }
}

export type TopPage = {
  path: string;
  views: number;
  unique: number;
};

export async function getTopPages(limit = 15): Promise<TopPage[]> {
  try {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        path: pageViews.path,
        views: sql<number>`count(*)::int`,
        unique: sql<number>`count(distinct ${pageViews.ipHash})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, monthAgo))
      .groupBy(pageViews.path)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((r) => ({
      path: r.path,
      views: Number(r.views),
      unique: Number(r.unique),
    }));
  } catch (e) {
    logger.warn('analytics.top-pages.failed', {
      message: (e as Error).message,
    });
    return [];
  }
}

export type DailyViews = {
  day: string;
  views: number;
  unique: number;
};

export async function getDailyViews(days = 14): Promise<DailyViews[]> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        day: sql<string>`to_char(${pageViews.createdAt}::date, 'YYYY-MM-DD')`,
        views: sql<number>`count(*)::int`,
        unique: sql<number>`count(distinct ${pageViews.ipHash})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(sql`${pageViews.createdAt}::date`)
      .orderBy(sql`${pageViews.createdAt}::date`);

    return rows.map((r) => ({
      day: r.day,
      views: Number(r.views),
      unique: Number(r.unique),
    }));
  } catch (e) {
    logger.warn('analytics.daily-views.failed', {
      message: (e as Error).message,
    });
    return [];
  }
}

export type TopReferrer = {
  host: string;
  count: number;
};

export async function getTopReferrers(limit = 10): Promise<TopReferrer[]> {
  try {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        host: sql<string>`coalesce(substring(${pageViews.referrer} from 'https?://([^/]+)'), 'direct')`,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, monthAgo))
      .groupBy(
        sql`coalesce(substring(${pageViews.referrer} from 'https?://([^/]+)'), 'direct')`,
      )
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((r) => ({
      host: r.host || 'direct',
      count: Number(r.count),
    }));
  } catch (e) {
    logger.warn('analytics.referrers.failed', {
      message: (e as Error).message,
    });
    return [];
  }
}