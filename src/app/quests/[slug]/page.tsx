import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { quests, bossPhases, artifacts, customers } from '@/db/schema';
import { LootCard } from '@/components/LootCard';
import type { LootItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [quest] = await db
    .select({ title: quests.title, description: quests.description })
    .from(quests)
    .where(eq(quests.slug, slug));

  if (!quest) return { title: 'Квест не найден · QuestWork' };
  return {
    title: `${quest.title} · QuestWork`,
    description: quest.description.slice(0, 160),
  };
}

export default async function QuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [quest] = await db
    .select({
      id: quests.id,
      slug: quests.slug,
      title: quests.title,
      description: quests.description,
      icon: quests.icon,
      bossName: quests.bossName,
      bossMaxHp: quests.bossMaxHp,
      difficulty: quests.difficulty,
      rewardXp: quests.rewardXp,
      rewardGold: quests.rewardGold,
      victoryThreshold: quests.victoryThreshold,
      status: quests.status,
      customerId: quests.customerId,
    })
    .from(quests)
    .where(eq(quests.slug, slug));

  if (!quest || quest.status !== 'active') notFound();

  const phases = await db
    .select()
    .from(bossPhases)
    .where(eq(bossPhases.questId, quest.id))
    .orderBy(bossPhases.phaseOrder);

  const questArtifacts = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.questId, quest.id));

  // Информация о заказчике, если квест создан работодателем
  let customer: { companyName: string; slug: string } | null = null;
  if (quest.customerId) {
    const [c] = await db
      .select({
        companyName: customers.companyName,
        slug: customers.slug,
      })
      .from(customers)
      .where(eq(customers.id, quest.customerId));
    customer = c ?? null;
  }

  const stars =
    '★'.repeat(quest.difficulty) + '☆'.repeat(Math.max(0, 5 - quest.difficulty));

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/quests"
          className="text-sm text-zinc-500 hover:text-amber-400"
        >
          ← Все квесты
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-start gap-5 mb-5">
            <div className="text-6xl">{quest.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="text-xs text-amber-400">
                  СЛОЖНОСТЬ {stars}
                </div>
                {customer && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-700/40">
                    от {customer.companyName}
                  </span>
                )}
              </div>
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

        {questArtifacts.length > 0 && (
          <>
            <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
              НАГРАДА ЗА ПОБЕДУ
            </h2>
            <div className="space-y-2">
              {questArtifacts.map((a) => {
                const item: LootItem = {
                  id: a.id,
                  slug: a.slug,
                  name: a.name,
                  description: a.description,
                  icon: a.icon,
                  rarity: a.rarity as LootItem['rarity'],
                  isNew: false,
                };
                return <LootCard key={a.id} item={item} />;
              })}
            </div>
          </>
        )}

        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          ФАЗЫ БОССА · {quest.bossMaxHp} HP
        </h2>

        <div className="space-y-2">
          {phases.map((p, idx) => (
            <div
              key={p.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="text-xs text-zinc-600 font-mono w-6 pt-1">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div>
                  <div className="font-medium mb-1">{p.name}</div>
                  <div className="text-xs text-zinc-500">{p.description}</div>
                </div>
              </div>
              <div className="text-xs text-amber-400 shrink-0 font-mono">
                -{p.maxHp} HP
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/20 p-4 text-xs text-zinc-500">
          <div className="font-medium text-zinc-400 mb-1">Как проходить</div>
          <p>
            Сдайте ссылку на GitHub-репозиторий. Платформа проверит его по
            фазам. Победа — если урон не меньше {quest.victoryThreshold}% от{' '}
            {quest.bossMaxHp} HP.
          </p>
        </div>
      </div>
    </main>
  );
}