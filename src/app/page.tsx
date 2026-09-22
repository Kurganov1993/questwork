import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      {/* Header */}
      <header className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-400 font-bold">
            Q
          </div>
          <span className="font-semibold tracking-wide">QUESTWORK</span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-zinc-400">
          <Link href="#quests" className="hover:text-amber-400">Квесты</Link>
          <Link href="#how" className="hover:text-amber-400">Как это работает</Link>
          <Link
            href="/verify"
            className="px-4 py-2 rounded-md bg-amber-500 text-black font-medium hover:bg-amber-400 transition"
          >
            Проверить код
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-amber-400/80 text-sm tracking-widest mb-4">
          НАЙМ КАК РЕЙД
        </p>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Прокачай героя.<br />
          Победи босса.<br />
          <span className="text-amber-400">Получи работу.</span>
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto mb-10 text-lg">
          Здесь не откликаются на вакансии. Здесь берут квесты,
          сдают репозитории и наносят урон боссу — фазе за фазой.
          Твоё портфолио — это твой персонаж.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/verify"
            className="px-6 py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            Начать квест
          </Link>
          <Link
            href="#how"
            className="px-6 py-3 rounded-md border border-zinc-700 hover:border-amber-500/60 transition"
          >
            Как это работает
          </Link>
        </div>
      </section>

      {/* Active quest card */}
      <section id="quests" className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-sm text-zinc-500 tracking-widest mb-4">АКТИВНЫЙ КВЕСТ</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-amber-500/40 transition">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs text-amber-400 mb-2">СЛОЖНОСТЬ ★</div>
              <h3 className="text-2xl font-semibold mb-2">Создать интернет-магазин</h3>
              <p className="text-zinc-400 mb-4 max-w-xl">
                Древний Торговец захватил рынок. Постройте витрину, корзину
                и оформление заказа, чтобы сразить его.
              </p>
              <div className="flex gap-6 text-sm text-zinc-500">
                <span>👑 Босс: <span className="text-zinc-300">Древний Торговец</span></span>
                <span>❤️ 100 HP</span>
                <span>✨ 500 XP</span>
                <span>🪙 30 золота</span>
              </div>
            </div>
            <Link
              href="/verify?quest=create-shop"
              className="shrink-0 px-5 py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
            >
              Принять квест
            </Link>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-sm text-zinc-500 tracking-widest mb-8 text-center">
          КАК ЭТО РАБОТАЕТ
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: '01', t: 'Выбери класс', d: 'Frontend Mage, Backend Warrior, DevOps Paladin и другие.' },
            { n: '02', t: 'Возьми квест', d: 'Реальная задача с критериями приёмки и боссом.' },
            { n: '03', t: 'Сдай репозиторий', d: 'GitHub-ссылка. Платформа проверяет код по фазам.' },
            { n: '04', t: 'Победи босса', d: 'Получи XP, лут и репутацию. Портфолио растёт.' },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-amber-500/70 text-xs mb-2">{s.n}</div>
              <div className="font-semibold mb-2">{s.t}</div>
              <div className="text-sm text-zinc-400">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-600">
        QuestWork · прототип
      </footer>
    </main>
  );
}