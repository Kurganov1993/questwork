import Link from 'next/link';
import { db } from '@/db';
import { quests, submissions } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { getCurrentHero } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function QuestsPage() {
  const hero = await getCurrentHero();

  const allQuests = await db.select().from(quests).orderBy(quests.difficulty);

  // Для каждого квеста — сколько побед у текущего героя
  let victoriesByQuest: Record<number, number> = {};
  if (hero) {
    const rows = await db
      .select({
        questId: submissions.questId,
        count: sql<number>`count(*)::int`,
      })
      .from(submissions)
      .where(eq(submissions.heroId, hero.id))
      .groupBy(submissions.questId);
    victoriesByQuest = Object.fromEntries(rows.map((r) => [r.questId, r.count]));
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Доска квестов</h1>
        <p className="text-zinc-400 mb-8">
          Возьми квест, сдай репозиторий, победи босса.
        </p>

        <div className="space-y-4">
          {allQuests.map((q) => {
            const stars = '★'.repeat(q.difficulty) + '☆'.repeat(Math.max(0, 3 - q.difficulty));
            const cleared = (victoriesByQuest[q.id] ?? 0) > 0;
            return (
              <Link
                key={q.id}
                href={`/quests/${q.slug}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-amber-500/60 transition"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{q.icon}</div>
                    <div>
                      <div className="text-xs text-amber-400 mb-1">СЛОЖНОСТЬ {stars}</div>
                      <h2 className="text-xl font-semibold mb-2">{q.title}</h2>
                      <p className="text-zinc-400 text-sm mb-3 max-w-xl">
                        {q.description}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                        <span>
                          👑 {q.bossName}
                        </span>
                        <span>❤️ {q.bossMaxHp} HP</span>
                        <span>✨ {q.rewardXp} XP</span>
                        <span>🪙 {q.rewardGold}</span>
                        <span>порог {q.victoryThreshold}%</span>
                        {cleared && (
                          <span className="text-emerald-400">✔ пройден</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-amber-400 text-sm shrink-0 pt-2">→</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}