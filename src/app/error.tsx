'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[client-error]', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="text-7xl mb-6">💥</div>
        <div className="text-xs font-mono tracking-[0.3em] text-red-400 mb-3">
          500 · ЧТО-ТО СЛОМАЛОСЬ
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Магия дала сбой
        </h1>
        <p className="text-zinc-400 mb-8">
          Мы уже записали это в журнал и разбираемся. Попробуй обновить
          страницу или вернуться на главную.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg glass hover:bg-white/5 font-semibold transition"
          >
            На главную
          </Link>
        </div>
        {error.digest && (
          <div className="mt-6 text-xs text-zinc-600 font-mono">
            Код ошибки: {error.digest}
          </div>
        )}
      </div>
    </main>
  );
}