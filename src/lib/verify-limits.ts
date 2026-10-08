import { db } from '@/db';
import { submissions } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { withRetry } from './db-retry';
import { logger } from './logger';

export function repoKeyFromUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const parts = u.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.git$/, '')
      .toLowerCase()
      .split('/');
    if (parts.length < 2) return url.slice(0, 300);
    return `${parts[0]}/${parts[1]}`.slice(0, 300);
  } catch {
    return url.slice(0, 300);
  }
}

export type RepeatCheck = {
  allowed: boolean;
  count: number;
  limit: number;
  message?: string;
};

const REPEAT_LIMIT = 3;

export async function checkRepoRepeat(
  heroId: number,
  repoUrl: string,
): Promise<RepeatCheck> {
  const repoKey = repoKeyFromUrl(repoUrl);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const [row] = await withRetry(
      () =>
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(submissions)
          .where(
            and(
              eq(submissions.heroId, heroId),
              eq(submissions.repoKey, repoKey),
              gte(submissions.createdAt, dayAgo),
            ),
          ),
      { label: 'verify:repo-repeat' },
    );

    const count = Number(row?.n ?? 0);

    if (count >= REPEAT_LIMIT) {
      return {
        allowed: false,
        count,
        limit: REPEAT_LIMIT,
        message: `Этот репозиторий уже сдавался ${count} раз за последние 24 часа. Лимит — ${REPEAT_LIMIT}. Попробуй другой репозиторий или подожди.`,
      };
    }

    return { allowed: true, count, limit: REPEAT_LIMIT };
  } catch (e) {
    logger.warn('verify:repo-repeat.failed', {
      message: (e as Error).message,
    });
    return { allowed: true, count: 0, limit: REPEAT_LIMIT };
  }
}