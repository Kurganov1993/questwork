'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function EmployerRegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/employer/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          email,
          password,
          acceptedTerms,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Ошибка регистрации');
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

        <h1 className="text-3xl font-bold mt-6 mb-2">Кабинет работодателя</h1>
        <p className="text-zinc-400 mb-8">
          Публикуйте квесты и находите героев по проверенным навыкам.
        </p>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Название компании
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Рога и Копыта"
              className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hr@company.ru"
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
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
              disabled={loading}
            />
            <div className="text-xs text-zinc-500 mt-1">
              Минимум 6 символов. Восстановление пароля пока не работает —
              сохрани его в надёжном месте.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="employer-accept-terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={loading}
              className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/40"
            />
            <label
              htmlFor="employer-accept-terms"
              className="text-xs text-zinc-400 leading-relaxed cursor-pointer"
            >
              Я принимаю{' '}
              <Link
                href="/legal/terms"
                target="_blank"
                className="text-amber-400 hover:text-amber-300 underline"
              >
                Пользовательское соглашение
              </Link>{' '}
              и даю согласие на обработку персональных данных в соответствии с{' '}
              <Link
                href="/legal/privacy"
                target="_blank"
                className="text-amber-400 hover:text-amber-300 underline"
              >
                Политикой конфиденциальности
              </Link>
              .
            </label>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="w-full py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Создаём…' : 'Зарегистрировать компанию'}
          </button>

          <div className="text-center text-sm text-zinc-500">
            Уже есть аккаунт?{' '}
            <Link
              href="/employer/login"
              className="text-amber-400 hover:text-amber-300"
            >
              Войти
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}