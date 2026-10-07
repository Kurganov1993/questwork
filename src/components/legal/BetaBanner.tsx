'use client';

import { useEffect, useState } from 'react';
import { LEGAL } from '@/lib/legal-config';

const STORAGE_KEY = 'qw_beta_notice_dismissed_v1';

export function BetaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative z-30 border-b border-amber-500/20 bg-gradient-to-r from-amber-950/30 via-amber-900/20 to-amber-950/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3 text-xs">
        <span className="shrink-0 text-amber-400">🧪</span>
        <div className="flex-1 text-amber-200/90">
          <span className="font-semibold">Бета-версия.</span> Возможны сбои и
          потеря данных. Если нашёл проблему —{' '}
          <a
            href={`mailto:${LEGAL.operator.supportEmail}`}
            className="underline hover:text-amber-300"
          >
            напиши нам
          </a>
          .
        </div>
        <button
          onClick={dismiss}
          aria-label="Скрыть уведомление"
          className="shrink-0 text-amber-400/60 hover:text-amber-300 transition text-base leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}