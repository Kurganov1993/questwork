import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/db';
import { quests, bossPhases, submissions, heroes } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { HERO_CLASSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function EmployerQuestPage({
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

  const subs = await db
    .select({
      id: submissions.id,
      repoUrl: submissions.repoUrl,
      status: submissions.status,
      damageDealt: submissions.damageDealt,
      createdAt: submissions.createdAt,
      heroId: heroes.id,
      heroNickname: heroes.nickname,
      heroClass: heroes.heroClass,
      heroLevel: heroes.level,
    })
    .from(submissions)
    .innerJoin(heroes, eq(heroes.id, submissions.heroId))
    .where(eq(submissions.questId, quest.id))
    .orderBy(desc(submissions.createdAt))
    .limit(100);

  const victories = subs.filter((s) => s.status === 'victory').length;
  const uniqueHeroes = new Set(subs.map((s) => s.heroId)).size;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/employer"
          className="text-sm text-zinc-500 hover:text-amber-400"
        >
          ← В кабинет
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-start gap-5">
            <div className="text-5xl">{quest.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold">{quest.title}</h1>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    quest.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-zinc-500/20 text-zinc-300'
                  }`}
                >
                  {quest.status}
                </span>
              </div>
              <p className="text-zinc-400 text-sm mb-3">{quest.description}</p>
              <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                <span>👑 {quest.bossName}</span>
                <span>❤️ {quest.bossMaxHp} HP</span>
                <span>✨ {quest.rewardXp} XP</span>
                <span>🪙 {quest.rewardGold}</span>
                <span>порог {quest.victoryThreshold}%</span>
                <span>сложность {quest.difficulty}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-zinc-800/60">
            <div className="text-center">
              <div className="text-xs text-zinc-500">Сдач</div>
              <div className="text-2xl font-semibold">{subs.length}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500">Побед</div>
              <div className="text-2xl font-semibold text-emerald-400">
                {victories}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500">Героев</div>
              <div className="text-2xl font-semibold">{uniqueHeroes}</div>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <Link
              href={`/quests/${quest.slug}`}
              className="px-4 py-2 rounded-md border border-zinc-700 text-sm text-zinc-300 hover:border-amber-500/60"
            >
              Публичная страница
            </Link>
          </div>
        </div>

        {/* Фазы */}
        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          ФАЗЫ · {phases.length} · {quest.bossMaxHp} HP
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
                <div className="text-xs text-zinc-600 mt-1 font-mono">
                  {p.checkType}
                </div>
              </div>
              <div className="text-xs text-amber-400 shrink-0">
                -{p.maxHp} HP
              </div>
            </div>
          ))}
        </div>

        {/* Сдачи */}
        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          СДАЧИ · {subs.length}
        </h2>

        {subs.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-500 text-sm">
            Пока никто не сдавал этот квест. Поделитесь ссылкой на публичную
            страницу.
          </div>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => {
              const cls = HERO_CLASSES.find((c) => c.value === s.heroClass);
              const victory = s.status === 'victory';
              const pct = Math.round(
                (s.damageDealt / (quest.bossMaxHp || 110)) * 100,
              );

              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 ${
                    victory
                      ? 'border-emerald-800/40 bg-emerald-950/10'
                      : 'border-red-900/40 bg-red-950/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <Link
                      href={`/u/${s.heroNickname}`}
                      className="flex items-center gap-3 hover:opacity-90"
                    >
                      <span className="text-2xl">{cls?.icon ?? '🧙'}</span>
                      <div>
                        <div className="font-medium">{s.heroNickname}</div>
                        <div className="text-xs text-zinc-500">
                          {cls?.label ?? s.heroClass} · ур. {s.heroLevel}
                        </div>
                      </div>
                    </Link>

                    <div
                      className={`text-xs px-2 py-0.5 rounded ${
                        victory
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {victory ? 'победа' : 'поражение'} · {pct}%
                    </div>
                  </div>

                  <a
                    href={s.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-500 font-mono truncate block mt-2 hover:text-amber-400"
                  >
                    {s.repoUrl}
                  </a>
                  <div className="text-xs text-zinc-600 mt-1">
                    {new Date(s.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}