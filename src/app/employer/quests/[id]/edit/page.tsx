import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { quests, bossPhases } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { QuestForm, type QuestFormData } from '@/components/QuestForm';

export const dynamic = 'force-dynamic';

export default async function EditQuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/employer/login');

  const { id } = await params;
  const questId = Number(id);
  if (!Number.isFinite(questId)) notFound();

  const [quest] = await db
    .select()
    .from(quests)
    .where(and(eq(quests.id, questId), eq(quests.customerId, customer.id)));

  if (!quest) notFound();

  const phases = await db
    .select()
    .from(bossPhases)
    .where(eq(bossPhases.questId, quest.id))
    .orderBy(bossPhases.phaseOrder);

  const initial: QuestFormData = {
    title: quest.title,
    description: quest.description,
    icon: quest.icon,
    bossName: quest.bossName,
    difficulty: quest.difficulty,
    rewardXp: quest.rewardXp,
    rewardGold: quest.rewardGold,
    victoryThreshold: quest.victoryThreshold,
    phases: phases.map((p) => ({
      name: p.name,
      description: p.description,
      checkType: p.checkType,
      maxHp: p.maxHp,
    })),
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/employer/quests/${questId}`}
          className="text-sm text-zinc-500 hover:text-amber-400"
        >
          ← К квесту
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Редактирование</h1>
        <p className="text-zinc-400 mb-8">{quest.title}</p>

        <QuestForm mode="edit" questId={questId} initial={initial} />
      </div>
    </main>
  );
}