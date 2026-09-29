'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function MarkAllSeenButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAll() {
    setLoading(true);
    try {
      const res = await fetch('/api/hero/notifications/mark-all', {
        method: 'POST',
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={markAll}
      disabled={loading}
      className="px-4 py-2 rounded-md border border-zinc-700 text-sm text-zinc-300 hover:border-amber-500/60 transition disabled:opacity-50"
    >
      {loading ? 'Отмечаем…' : 'Отметить все просмотренными'}
    </button>
  );
}