import { db } from '@/db';
import { aiUsage } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { withRetry } from '../db-retry';
import { logger } from '../logger';

const DAILY_LIMIT_USD = Number(process.env.AI_DAILY_LIMIT_USD ?? 0.5);

export type QuotaCheck = {
  allowed: boolean;
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
  resetAt: Date;
};

/**
 * Проверяет, не превысил ли герой дневной лимит расходов на AI.
 * Считает только успешные запросы (status='ok') за последние 24 часа.
 */
export async function checkAiQuota(heroId: number): Promise<QuotaCheck> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const [row] = await withRetry(
      () =>
        db
          .select({
            spent: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
          })
          .from(aiUsage)
          .where(
            and(
              eq(aiUsage.heroId, heroId),
              eq(aiUsage.status, 'ok'),
              gte(aiUsage.createdAt, dayAgo),
            ),
          ),
      { label: 'ai-quota:check' },
    );

    const spentUsd = Number(row?.spent ?? 0);

    return {
      allowed: spentUsd < DAILY_LIMIT_USD,
      spentUsd,
      limitUsd: DAILY_LIMIT_USD,
      remainingUsd: Math.max(0, DAILY_LIMIT_USD - spentUsd),
      resetAt,
    };
  } catch (e) {
    logger.warn('ai-quota.check.failed', {
      heroId,
      message: (e as Error).message,
    });
    // Fail open — если БД лежит, не блокируем
    return {
      allowed: true,
      spentUsd: 0,
      limitUsd: DAILY_LIMIT_USD,
      remainingUsd: DAILY_LIMIT_USD,
      resetAt,
    };
  }
}