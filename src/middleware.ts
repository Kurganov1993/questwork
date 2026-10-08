import { NextRequest, NextResponse } from 'next/server';

/**
 * CSRF-защита через проверку Origin.
 * Все современные браузеры отправляют Origin на POST/PUT/PATCH/DELETE.
 * Если Origin есть и не совпадает с нашим — блокируем.
 * Если Origin нет — пропускаем (curl, health-checks, GitHub webhooks).
 *
 * Это дополняет sameSite=lax на session cookie.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getExpectedOrigins(): string[] {
  const origins: string[] = [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      origins.push(new URL(appUrl).origin);
    } catch {
      /* ignore */
    }
  }

  // Dev-окружение
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }

  return origins;
}

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  // Пропускаем безопасные методы
  if (SAFE_METHODS.has(req.method)) {
    return NextResponse.next();
  }

  const origin = normalizeOrigin(req.headers.get('origin'));
  const referer = normalizeOrigin(req.headers.get('referer'));

  // Если ни Origin, ни Referer нет — это либо curl, либо старый клиент,
  // либо webhook. Пропускаем, но не даём браузеру подделать.
  if (!origin && !referer) {
    return NextResponse.next();
  }

  const expected = getExpectedOrigins();
  const source = origin ?? referer!;

  if (expected.length > 0 && !expected.includes(source)) {
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: 'CSRF: неверный источник запроса',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Все пути кроме:
     * - /_next/*       — статика Next.js
     * - /favicon.ico   — иконка
     * - /api/auth/github/callback — GitHub OAuth callback (Origin может быть github.com)
     * - /api/analytics/track — фоновая телеметрия (может не иметь Origin)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth/github/callback|api/analytics/track).*)',
  ],
};