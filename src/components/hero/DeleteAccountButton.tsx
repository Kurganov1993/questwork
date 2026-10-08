'use client';

import { useState } from 'react';

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (loading) return;
    setOpen(false);
    setPassword('');
    setConfirmText('');
    setError(null);
  }

  async function confirmDelete() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/hero/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmText }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Не удалось удалить аккаунт');
        return;
      }
      window.location.href = '/';
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    password.length > 0 &&
    confirmText.trim().toLowerCase() === 'удалить мой аккаунт' &&
    !loading;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-600 hover:text-red-400 transition"
      >
        Удалить аккаунт
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={close}
          />

          <div className="relative w-full max-w-md glass-strong rounded-2xl p-6">
            <div className="text-2xl mb-2">⚠️</div>
            <h2 className="text-xl font-semibold mb-3">
              Удалить аккаунт навсегда?
            </h2>

            <div className="text-sm text-zinc-400 mb-5 space-y-2">
              <p>Это действие нельзя отменить. Будут удалены:</p>
              <ul className="text-xs space-y-1 pl-4">
                <li>— профиль героя и весь прогресс</li>
                <li>— все артефакты и достижения</li>
                <li>— история сдач квестов</li>
                <li>— привязка GitHub</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 focus:border-red-500/60 outline-none text-sm"
                  placeholder="••••••"
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  Набери{' '}
                  <span className="text-red-400 font-mono">
                    удалить мой аккаунт
                  </span>
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 focus:border-red-500/60 outline-none text-sm font-mono"
                  placeholder="удалить мой аккаунт"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-xl p-3">
                {error}
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={close}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-zinc-300 hover:bg-white/5 transition disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                disabled={!canSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-700/60 text-red-300 font-semibold text-sm hover:bg-red-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Удаляем…' : 'Удалить навсегда'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}