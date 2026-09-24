'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HERO_CLASSES, type HeroClassValue } from '@/lib/constants';

export default function RegisterPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [heroClass, setHeroClass] = useState<HeroClassValue>('frontend_mage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, password, heroClass }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Ошибка регистрации');
      } else {
        router.push('/hero');
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
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Создать героя</h1>
        <p className="text-zinc-400 mb-8">
          Выбери класс и начни свой путь. Ник нельзя изменить.
        </p>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5"
        >
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Класс героя</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HERO_CLASSES.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setHeroClass(c.value)}
                  className={`rounded-lg border p-3 text-left transition ${
                    heroClass === c.value
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 bg-zinc-950/40 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{c.icon}</div>
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Ник</label>
            <input
              type="text"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="argon_the_great"
              className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none font-mono text-sm"
              disabled={loading}
            />
            <div className="text-xs text-zinc-500 mt-1">
              3–32 символа, латиница, цифры, _ и -
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none font-mono text-sm"
              disabled={loading}
            />
            <div className="text-xs text-zinc-500 mt-1">Минимум 6 символов</div>
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
            {loading ? 'Создаём…' : 'Создать героя'}
          </button>

          <div className="text-center text-sm text-zinc-500">
            Уже есть герой?{' '}
            <Link href="/login" className="text-amber-400 hover:text-amber-300">
              Войти
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}