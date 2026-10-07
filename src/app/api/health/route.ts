import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isDockerAvailable } from '@/lib/docker/client';
import { getProviderInfo } from '@/lib/ai/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startTime = Date.now();

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

export async function GET() {
  const checks: Record<string, Check> = {};

  // --- Database ---
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

  // --- Docker ---
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

  // --- AI ---
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

  const dbOk = checks.database.ok;
  const othersOk = checks.docker.ok && checks.ai.ok;

  // down — только если БД недоступна. Docker/AI — degraded.
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
    },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}