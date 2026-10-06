'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DisconnectGithubButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function disconnect() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/github/disconnect', { method: 'POST' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex gap-2 items-center">
        <span className="text-xs text-zinc-400">Отключить?</span>
        <button
          onClick={disconnect}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-700/60 text-red-300 text-xs hover:bg-red-500/30 disabled:opacity-50"
        >
          {loading ? '…' : 'Да'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-zinc-400"
        >
          Нет
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-zinc-500 hover:text-red-400 transition"
    >
      Отключить
    </button>
  );
}