import { db } from '@/db';
import { aiUsage } from '@/db/schema';
import { sql, gte } from 'drizzle-orm';
import { logger } from '../logger';

export type AiUsageInput = {
  heroId?: number;
  questId?: number;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs: number;
  status: 'ok' | 'error';
  errorMessage?: string;
};

const PRICING: Record<string, { in: number; out: number }> = {
  'openai/gpt-4o-mini-2024-07-18': { in: 0.15, out: 0.6 },
  'openai/gpt-4o-2024-08-06': { in: 2.5, out: 10 },
  'anthropic/claude-3-5-haiku-20241022': { in: 0.8, out: 4 },
  'anthropic/claude-sonnet-4.6': { in: 3, out: 15 },
};

export function estimateCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
}

export async function recordAiUsage(input: AiUsageInput): Promise<void> {
  const tokensIn = input.tokensIn ?? 0;
  const tokensOut = input.tokensOut ?? 0;
  const costUsd = estimateCostUsd(input.model, tokensIn, tokensOut);

  try {
    await db.insert(aiUsage).values({
      heroId: input.heroId ?? null,
      questId: input.questId ?? null,
      provider: input.provider,
      model: input.model,
      tokensIn,
      tokensOut,
      costUsd: costUsd.toFixed(6),
      durationMs: input.durationMs,
      status: input.status,
      errorMessage: input.errorMessage?.slice(0, 500) ?? null,
    });
  } catch (e) {
    logger.warn('ai-usage.record.failed', {
      message: (e as Error).message,
    });
  }
}

export type AiUsageStats = {
  today: {
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  };
  last30Days: {
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  };
};

export async function getAiUsageStats(): Promise<AiUsageStats> {
  const empty = {
    today: { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 },
    last30Days: { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 },
  };

  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [todayRows, monthRows] = await Promise.all([
      db
        .select({
          calls: sql<number>`count(*)::int`,
          tokensIn: sql<number>`coalesce(sum(${aiUsage.tokensIn}), 0)::int`,
          tokensOut: sql<number>`coalesce(sum(${aiUsage.tokensOut}), 0)::int`,
          costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, todayStart)),
      db
        .select({
          calls: sql<number>`count(*)::int`,
          tokensIn: sql<number>`coalesce(sum(${aiUsage.tokensIn}), 0)::int`,
          tokensOut: sql<number>`coalesce(sum(${aiUsage.tokensOut}), 0)::int`,
          costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, thirtyDaysAgo)),
    ]);

    const t = todayRows[0];
    const m = monthRows[0];

    return {
      today: {
        calls: Number(t?.calls ?? 0),
        tokensIn: Number(t?.tokensIn ?? 0),
        tokensOut: Number(t?.tokensOut ?? 0),
        costUsd: Number(t?.costUsd ?? 0),
      },
      last30Days: {
        calls: Number(m?.calls ?? 0),
        tokensIn: Number(m?.tokensIn ?? 0),
        tokensOut: Number(m?.tokensOut ?? 0),
        costUsd: Number(m?.costUsd ?? 0),
      },
    };
  } catch (e) {
    logger.warn('ai-usage.stats.failed', {
      message: (e as Error).message,
    });
    return empty;
  }
}