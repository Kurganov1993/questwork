import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="text-7xl mb-6 animate-float">🗺️</div>
        <div className="text-xs font-mono tracking-[0.3em] text-amber-400 mb-3">
          404 · КВЕСТ НЕ НАЙДЕН
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Здесь ничего нет
        </h1>
        <p className="text-zinc-400 mb-8">
          Страница, которую ты ищешь, потерялась где-то между мирами. Возможно,
          она была удалена или никогда не существовала.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            На главную
          </Link>
          <Link
            href="/quests"
            className="px-5 py-2.5 rounded-lg glass hover:bg-white/5 font-semibold transition"
          >
            К доске квестов
          </Link>
        </div>
      </div>
    </main>
  );
}