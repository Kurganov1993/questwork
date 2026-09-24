import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { quests, bossPhases } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { VerifyClient } from './VerifyClient';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ quest?: string }>;
}) {
  const { quest: questSlug } = await searchParams;
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  const [quest] = await db
    .select()
    .from(quests)
    .where(eq(quests.slug, questSlug ?? 'create-shop'));

  if (!quest) notFound();

  const phases = await db
    .select({
      phaseOrder: bossPhases.phaseOrder,
      name: bossPhases.name,
    })
    .from(bossPhases)
    .where(eq(bossPhases.questId, quest.id));

  const phaseNames = phases
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map((p) => p.name);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/quests" className="text-sm text-zinc-500 hover:text-amber-400">
          ← Все квесты
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Проверка кода</h1>
        <p className="text-zinc-400 mb-8">
          Квест «{quest.title}» · Босс:{' '}
          <span className="text-amber-400">{quest.bossName}</span>
        </p>

        <VerifyClient
          questSlug={quest.slug}
          questTitle={quest.title}
          bossName={quest.bossName}
          bossMaxHp={quest.bossMaxHp}
          phaseNames={phaseNames}
        />
      </div>
    </main>
  );
}