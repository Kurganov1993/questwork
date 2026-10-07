'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'qw_cookie_consent_v1';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage может быть недоступен */
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accepted: true, at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Уведомление об использовании cookie"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-fade-in-up"
    >
      <div className="glass-strong rounded-2xl p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl shrink-0">🍪</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold mb-1">Мы используем cookie</div>
            <div className="text-xs text-zinc-400 leading-relaxed">
              Только строго необходимые — для авторизации и защиты от CSRF.
              Никакой аналитики и рекламы.{' '}
              <Link
                href="/legal/cookies"
                className="text-amber-400 hover:text-amber-300"
              >
                Подробнее
              </Link>
              .
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={accept}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition text-sm"
          >
            Понятно
          </button>
          <Link
            href="/legal/cookies"
            className="px-4 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:border-amber-500/60 hover:text-amber-400 transition text-sm text-center"
          >
            Подробнее
          </Link>
        </div>
      </div>
    </div>
  );
}