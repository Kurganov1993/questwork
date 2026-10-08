import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isDockerAvailable } from '@/lib/docker/client';
import { getProviderInfo } from '@/lib/ai/client';
import { getAiUsageStats } from '@/lib/ai/usage';
import { getBuildQueueStats } from '@/lib/build-lock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startTime = Date.now();

const healthRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function checkHealthRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = healthRateLimit.get(ip);

  if (!entry || now > entry.resetAt) {
    healthRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [ip, entry] of healthRateLimit.entries()) {
    if (now > entry.resetAt) healthRateLimit.delete(ip);
  }
}

type Check = {
  ok: boolean;
  latencyMs: number;
  info?: string;
};

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms),
    ),
  ]);
}

export async function GET(req: Request) {
  maybeCleanup();

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : req.headers.get('x-real-ip') ?? 'unknown';

  if (!checkHealthRateLimit(ip)) {
    return NextResponse.json(
      { status: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const checks: Record<string, Check> = {};

  // Database
  {
    const t = Date.now();
    try {
      await withTimeout(db.execute(sql`SELECT 1`), 3000, 'db');
      checks.database = { ok: true, latencyMs: Date.now() - t };
    } catch (e) {
      checks.database = {
        ok: false,
        latencyMs: Date.now() - t,
        info: (e as Error).message.slice(0, 120),
      };
    }
  }

  // Docker
  {
    const t = Date.now();
    try {
      const ok = await withTimeout(isDockerAvailable(), 3000, 'docker');
      checks.docker = {
        ok,
        latencyMs: Date.now() - t,
        info: ok ? undefined : 'недоступен',
      };
    } catch (e) {
      checks.docker = {
        ok: false,
        latencyMs: Date.now() - t,
        info: (e as Error).message.slice(0, 120),
      };
    }
  }

  // AI
  {
    const info = getProviderInfo();
    checks.ai = {
      ok: info.ready,
      latencyMs: 0,
      info: info.ready
        ? `${info.provider}/${info.model}`
        : info.reason ?? 'не настроен',
    };
  }

  // AI usage
  let aiStats: Awaited<ReturnType<typeof getAiUsageStats>> | null = null;
  try {
    aiStats = await withTimeout(getAiUsageStats(), 2000, 'ai-stats');
  } catch {
    /* ignore */
  }

  const dbOk = checks.database.ok;
  const othersOk = checks.docker.ok && checks.ai.ok;

  const status: 'ok' | 'degraded' | 'down' = !dbOk
    ? 'down'
    : othersOk
    ? 'ok'
    : 'degraded';

  const httpStatus = status === 'down' ? 503 : 200;

  return NextResponse.json(
    {
      status,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      checks,
      queue: getBuildQueueStats(),
      ai: aiStats
        ? {
            today: {
              ...aiStats.today,
              costUsd: Number(aiStats.today.costUsd.toFixed(4)),
            },
            last30Days: {
              ...aiStats.last30Days,
              costUsd: Number(aiStats.last30Days.costUsd.toFixed(4)),
            },
          }
        : null,
    },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}