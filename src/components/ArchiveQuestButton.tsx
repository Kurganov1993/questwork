'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ArchiveQuestButton({ questId }: { questId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function archive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/employer/quests/${questId}`, {
        method: 'DELETE',
      });
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
        <span className="text-xs text-zinc-400">Точно архивировать?</span>
        <button
          onClick={archive}
          disabled={loading}
          className="px-3 py-2 rounded-md bg-red-500/20 border border-red-700/60 text-red-300 text-xs hover:bg-red-500/30 transition disabled:opacity-50"
        >
          {loading ? '…' : 'Да'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-2 rounded-md border border-zinc-700 text-xs text-zinc-400"
        >
          Отмена
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-4 py-2 rounded-md border border-zinc-700 text-sm text-zinc-400 hover:border-red-700/60 hover:text-red-400 transition"
    >
      Архивировать
    </button>
  );
}