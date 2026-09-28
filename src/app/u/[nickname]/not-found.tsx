import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-20">
      <div className="max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">👻</div>
        <h1 className="text-2xl font-bold mb-2">Герой не найден</h1>
        <p className="text-zinc-400 mb-8">
          Возможно, ник написан с ошибкой или герой ещё не создан.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/leaderboard"
            className="px-5 py-2.5 rounded-md border border-zinc-700 hover:border-amber-500/60 transition text-sm"
          >
            К лидерборду
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition text-sm"
          >
            Создать героя
          </Link>
        </div>
      </div>
    </main>
  );
}