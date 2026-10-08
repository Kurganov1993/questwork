'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const COOKIE_NAME = 'qw_visitor';
const COOKIE_TTL_DAYS = 365;

function ensureVisitorCookie() {
  try {
    const existing = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (existing) return;

    // Не httpOnly — можно ставить с клиента
    const id = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
    const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    ensureVisitorCookie();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/admin')) return;
    if (pathname.startsWith('/api/')) return;

    const referrer =
      typeof document !== 'undefined' ? document.referrer || null : null;

    // Отправляем фоново, не ждём ответа
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, referrer }),
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [pathname]);

  return null;
}