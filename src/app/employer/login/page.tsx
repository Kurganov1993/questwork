'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function EmployerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'success') setSuccess(true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/employer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Ошибка входа');
      } else {
        router.push('/employer');
        router.refresh();
      }
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-8">Вход для работодателя</h1>

        {success && (
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-emerald-300 mb-6">
            ✓ Пароль обновлён. Войди с новым паролем.
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-50"
          >
            {loading ? 'Входим…' : 'Войти'}
          </button>

          <div className="text-center text-xs">
            <Link
              href="/forgot-password"
              className="text-zinc-500 hover:text-amber-400 transition"
            >
              Забыли пароль?
            </Link>
          </div>

          <div className="text-center text-sm text-zinc-500">
            Нет аккаунта?{' '}
            <Link
              href="/employer/register"
              className="text-amber-400 hover:text-amber-300"
            >
              Зарегистрировать
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}