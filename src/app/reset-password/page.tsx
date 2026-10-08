'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') ?? '';
    setToken(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== password2) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль минимум 6 символов');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Не удалось сбросить пароль');
      } else {
        router.push('/login?reset=success');
      }
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold mb-3">Ссылка повреждена</h1>
          <p className="text-zinc-400 mb-6">
            В ссылке нет токена. Запроси сброс пароля заново.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            Запросить ссылку
          </Link>
        </div>
      </main>
    );
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

        <h1 className="text-3xl font-bold mt-6 mb-2">Новый пароль</h1>
        <p className="text-zinc-400 mb-8">
          Придумай новый пароль. После сохранения ты сможешь войти с ним.
        </p>

        <form onSubmit={onSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Новый пароль
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 focus:border-amber-500/60 outline-none text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Повтори пароль
            </label>
            <input
              type="password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••"
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
            {loading ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </main>
  );
}