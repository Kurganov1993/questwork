import { NextResponse } from 'next/server';
import { getRepo, parseRepoUrl, GitHubError } from '@/lib/github';
import { promises as dns } from 'node:dns';

export const runtime = 'nodejs';

async function tryFetch(url: string, timeoutMs = 8000) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'questwork-prototype' },
    });
    return {
      url,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
    };
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const cause = err.cause as (Error & { code?: string }) | undefined;
    return {
      url,
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: err.message,
      cause: cause ? `${cause.name}: ${cause.message}${cause.code ? ` [${cause.code}]` : ''}` : null,
    };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') ?? 'https://github.com/vercel/next.js';
  const ref = parseRepoUrl(url);
  if (!ref) {
    return NextResponse.json({ ok: false, reason: 'parse', url }, { status: 400 });
  }

  const hasToken = !!process.env.GITHUB_TOKEN;
  const tokenPrefix = hasToken ? process.env.GITHUB_TOKEN!.slice(0, 4) : null;

  // Проверяем сеть до разных хостов
  const netProbes = await Promise.all([
    tryFetch('https://github.com'),
    tryFetch('https://api.github.com'),
    tryFetch('https://api.github.com/rate_limit'),
  ]);

  // DNS-резолв
  let dnsInfo: Record<string, unknown> = {};
  try {
    const a = await dns.resolve4('api.github.com').catch(() => null);
    const aaaa = await dns.resolve6('api.github.com').catch(() => null);
    dnsInfo = { ipv4: a, ipv6: aaaa };
  } catch (e) {
    dnsInfo = { error: (e as Error).message };
  }

  // Основной вызов
  let repoResult: Record<string, unknown>;
  try {
    const repo = await getRepo(ref.owner, ref.repo);
    repoResult = {
      ok: true,
      full_name: repo.full_name,
      default_branch: repo.default_branch,
    };
  } catch (e) {
    if (e instanceof GitHubError) {
      repoResult = { ok: false, status: e.status, message: e.message };
    } else {
      const err = e as Error & { cause?: unknown };
      repoResult = {
        ok: false,
        status: null,
        message: err.message,
        cause: (err.cause as Error)?.message ?? null,
      };
    }
  }

    return NextResponse.json({
    url,
    owner: ref.owner,
    repoName: ref.repo,          // ← было "repo"
    hasToken,
    tokenPrefix,
    node: process.version,
    env: {
      HTTP_PROXY: process.env.HTTP_PROXY ?? null,
      HTTPS_PROXY: process.env.HTTPS_PROXY ?? null,
      NO_PROXY: process.env.NO_PROXY ?? null,
    },
    dns: dnsInfo,
    netProbes,
    repoResult,                   // ← было "repo"
  });
}