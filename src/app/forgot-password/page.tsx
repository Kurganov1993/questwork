'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Ошибка');
      } else {
        setSent(true);
        if (data.resetUrl) setDevUrl(data.resetUrl);
      }
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center px-6">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="text-sm text-zinc-500 hover:text-amber-400 transition"
        >
          ← Ко входу
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Забыли пароль?</h1>
        <p className="text-zinc-400 mb-8">
          Укажи email, на который зарегистрирован аккаунт. Мы пришлём ссылку
          для сброса.
        </p>

        {sent ? (
          <div className="glass rounded-2xl p-6">
            <div className="text-3xl mb-3">📬</div>
            <div className="font-semibold mb-2">Проверь почту</div>
            <div className="text-sm text-zinc-400 mb-4">
              Если аккаунт с таким email существует и email подтверждён — мы
              отправили ссылку для сброса. Ссылка действует 1 час.
            </div>
            {devUrl && (
              <div className="pt-4 border-t border-white/5">
                <div className="text-xs text-zinc-500 mb-1">
                  Dev-ссылка (не отправлена по email):
                </div>
                <a
                  href={devUrl}
                  className="text-xs text-amber-300 hover:text-amber-200 underline break-all"
                >
                  {devUrl}
                </a>
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="glass rounded-2xl p-6 space-y-4"
          >
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 focus:border-amber-500/60 outline-none text-sm"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-xl p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-50"
            >
              {loading ? 'Отправляем…' : 'Отправить ссылку'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}