import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { quests, bossPhases } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function QuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [quest] = await db.select().from(quests).where(eq(quests.slug, slug));
  if (!quest) notFound();

  const phases = await db
    .select()
    .from(bossPhases)
    .where(eq(bossPhases.questId, quest.id))
    .orderBy(bossPhases.phaseOrder);

  const stars = '★'.repeat(quest.difficulty) + '☆'.repeat(Math.max(0, 3 - quest.difficulty));

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/quests" className="text-sm text-zinc-500 hover:text-amber-400">
          ← Все квесты
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-start gap-5 mb-5">
            <div className="text-6xl">{quest.icon}</div>
            <div className="flex-1">
              <div className="text-xs text-amber-400 mb-1">СЛОЖНОСТЬ {stars}</div>
              <h1 className="text-3xl font-bold mb-2">{quest.title}</h1>
              <p className="text-zinc-400 mb-4">{quest.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                <span>👑 {quest.bossName}</span>
                <span>❤️ {quest.bossMaxHp} HP</span>
                <span>✨ {quest.rewardXp} XP</span>
                <span>🪙 {quest.rewardGold}</span>
                <span>порог победы {quest.victoryThreshold}%</span>
              </div>
            </div>
          </div>

          <Link
            href={`/verify?quest=${quest.slug}`}
            className="block text-center w-full py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            Принять квест
          </Link>
        </div>

        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          ФАЗЫ БОССА · {quest.bossMaxHp} HP
        </h2>

        <div className="space-y-2">
          {phases.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 flex items-start justify-between gap-4"
            >
              <div>
                <div className="font-medium mb-1">{p.name}</div>
                <div className="text-xs text-zinc-500">{p.description}</div>
              </div>
              <div className="text-xs text-amber-400 shrink-0">
                -{p.maxHp} HP
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}