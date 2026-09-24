import Link from 'next/link';
import { db } from '@/db';
import { quests } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const allQuests = await db.select().from(quests).orderBy(quests.difficulty).limit(3);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-amber-400/80 text-sm tracking-widest mb-4">НАЙМ КАК РЕЙД</p>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Прокачай героя.<br />
          Победи босса.<br />
          <span className="text-amber-400">Получи работу.</span>
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto mb-10 text-lg">
          Здесь не откликаются на вакансии. Здесь берут квесты, сдают репозитории
          и наносят урон боссу — фазе за фазой. Твоё портфолио — это твой персонаж.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/quests"
            className="px-6 py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            К доске квестов
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 rounded-md border border-zinc-700 hover:border-amber-500/60 transition"
          >
            Создать героя
          </Link>
        </div>
      </section>

      {/* Quests */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm text-zinc-500 tracking-widest">АКТИВНЫЕ КВЕСТЫ</h2>
          <Link href="/quests" className="text-xs text-amber-400 hover:text-amber-300">
            все квесты →
          </Link>
        </div>
        <div className="space-y-3">
          {allQuests.map((q) => {
            const stars = '★'.repeat(q.difficulty) + '☆'.repeat(Math.max(0, 3 - q.difficulty));
            return (
              <Link
                key={q.id}
                href={`/quests/${q.slug}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-amber-500/40 transition"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{q.icon}</div>
                    <div>
                      <div className="text-xs text-amber-400 mb-1">
                        СЛОЖНОСТЬ {stars}
                      </div>
                      <div className="text-lg font-semibold mb-1">{q.title}</div>
                      <p className="text-sm text-zinc-400 mb-2 max-w-xl">
                        {q.description}
                      </p>
                      <div className="flex gap-4 text-xs text-zinc-500">
                        <span>👑 {q.bossName}</span>
                        <span>❤️ {q.bossMaxHp} HP</span>
                        <span>✨ {q.rewardXp} XP</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-amber-400 text-sm shrink-0 pt-2">→</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
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