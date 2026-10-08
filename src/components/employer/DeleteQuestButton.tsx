'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteQuestButton({ questId }: { questId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/employer/quests/${questId}?mode=delete`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        window.location.href = '/employer/login';
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Не удалось удалить');
        return;
      }
      router.push('/employer');
      router.refresh();
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  const canDelete = confirmText.trim().toLowerCase() === 'удалить квест';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-md border border-zinc-700 text-sm text-zinc-400 hover:border-red-700/60 hover:text-red-400 transition"
      >
        Удалить
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !loading && setOpen(false)}
      />
      <div className="relative w-full max-w-md glass-strong rounded-2xl p-6">
        <div className="text-2xl mb-2">⚠️</div>
        <h2 className="text-xl font-semibold mb-3">Удалить квест навсегда?</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Будут удалены: фазы, все сдачи героев, артефакт. Это нельзя отменить.
          Если хочешь просто скрыть квест — используй «Архивировать».
        </p>

        <label className="block text-xs text-zinc-500 mb-1.5">
          Набери{' '}
          <span className="text-red-400 font-mono">удалить квест</span>
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={loading}
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 focus:border-red-500/60 outline-none text-sm font-mono mb-4"
          placeholder="удалить квест"
        />

        {error && <div className="text-xs text-red-400 mb-3">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={() => setOpen(false)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={confirmDelete}
            disabled={!canDelete || loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-700/60 text-red-300 font-semibold text-sm hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Удаляем…' : 'Удалить навсегда'}
          </button>
        </div>
      </div>
    </div>
  );
}