import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db';
import {
  submissions,
  quests,
  heroArtifacts,
  artifacts,
  heroAchievements,
  achievements as achievementsTable,
} from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { HERO_CLASSES } from '@/lib/constants';
import { LogoutButton } from '@/components/LogoutButton';
import { LootCard } from '@/components/LootCard';
import { AchievementCard } from '@/components/AchievementCard';
import { awardQuestArtifacts } from '@/lib/loot';
import { withRetry } from '@/lib/db-retry';
import type { LootItem, EarnedAchievementItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

function employerStatusLabel(status: string | null): string | null {
  if (!status) return null;
  switch (status) {
    case 'shortlisted':
      return 'в шортлисте';
    case 'interview':
      return 'приглашает на интервью';
    case 'hired':
      return 'нанял';
    case 'rejected':
      return 'отказ';
    default:
      return status;
  }
}

function employerStatusStyle(status: string | null): string {
  switch (status) {
    case 'hired':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-700/40';
    case 'rejected':
      return 'bg-red-500/20 text-red-300 border-red-700/40';
    case 'interview':
      return 'bg-amber-500/20 text-amber-300 border-amber-700/40';
    case 'shortlisted':
      return 'bg-blue-500/20 text-blue-300 border-blue-700/40';
    default:
      return 'bg-zinc-500/20 text-zinc-300 border-zinc-700/40';
  }
}

export default async function HeroPage() {
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  // Досылаем лут за прошлые победы, если БД упала в момент награды.
  // awardQuestArtifacts идемпотентен — повторные вызовы безопасны.
  try {
    const victorySubs = await withRetry(
      () =>
        db
          .select({ questId: submissions.questId })
          .from(submissions)
          .where(
            and(
              eq(submissions.heroId, hero.id),
              eq(submissions.status, 'victory'),
            ),
          )
          .groupBy(submissions.questId),
      { label: 'hero:backfill-victories' },
    );

    for (const v of victorySubs) {
      await awardQuestArtifacts(hero.id, v.questId);
    }
  } catch (e) {
    console.warn('[hero] loot backfill failed:', (e as Error).message);
  }

  const cls = HERO_CLASSES.find((c) => c.value === hero.heroClass);

  const mySubs = await withRetry(
    () =>
      db
        .select({
          id: submissions.id,
          repoUrl: submissions.repoUrl,
          status: submissions.status,
          damageDealt: submissions.damageDealt,
          createdAt: submissions.createdAt,
          employerStatus: submissions.employerStatus,
          employerNote: submissions.employerNote,
          questTitle: quests.title,
          questSlug: quests.slug,
          bossMaxHp: quests.bossMaxHp,
        })
        .from(submissions)
        .leftJoin(quests, eq(quests.id, submissions.questId))
        .where(eq(submissions.heroId, hero.id))
        .orderBy(desc(submissions.createdAt))
        .limit(20),
    { label: 'hero:list-subs' },
  );

  const myArtifacts = await withRetry(
    () =>
      db
        .select({
          id: artifacts.id,
          slug: artifacts.slug,
          name: artifacts.name,
          description: artifacts.description,
          icon: artifacts.icon,
          rarity: artifacts.rarity,
          earnedAt: heroArtifacts.earnedAt,
        })
        .from(heroArtifacts)
        .innerJoin(artifacts, eq(artifacts.id, heroArtifacts.artifactId))
        .where(eq(heroArtifacts.heroId, hero.id))
        .orderBy(desc(heroArtifacts.earnedAt)),
    { label: 'hero:list-artifacts' },
  );

  const myAchievements = await withRetry(
    () =>
      db
        .select({
          id: achievementsTable.id,
          slug: achievementsTable.slug,
          name: achievementsTable.name,
          description: achievementsTable.description,
          icon: achievementsTable.icon,
          xpReward: achievementsTable.xpReward,
          goldReward: achievementsTable.goldReward,
          earnedAt: heroAchievements.earnedAt,
        })
        .from(heroAchievements)
        .innerJoin(
          achievementsTable,
          eq(achievementsTable.id, heroAchievements.achievementId),
        )
        .where(eq(heroAchievements.heroId, hero.id))
        .orderBy(desc(heroAchievements.earnedAt)),
    { label: 'hero:list-achievements' },
  );

  const victories = mySubs.filter((s) => s.status === 'victory').length;
  const invitations = mySubs.filter(
    (s) => s.employerStatus === 'interview' || s.employerStatus === 'hired',
  ).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        {/* Карточка героя */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-start gap-5">
            <div className="text-6xl">{cls?.icon ?? '🧙'}</div>
            <div className="flex-1">
              <div className="text-sm text-zinc-500">
                {cls?.label ?? hero.heroClass}
              </div>
              <h1 className="text-3xl font-bold">{hero.nickname}</h1>
              <div className="flex flex-wrap gap-6 mt-3 text-sm">
                <div>
                  <div className="text-zinc-500">Уровень</div>
                  <div className="text-2xl font-semibold text-amber-400">
                    {hero.level}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">XP</div>
                  <div className="text-2xl font-semibold">{hero.xp}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Золото</div>
                  <div className="text-2xl font-semibold">🪙 {hero.gold}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Победы</div>
                  <div className="text-2xl font-semibold text-emerald-400">
                    {victories}
                  </div>
                </div>
                {invitations > 0 && (
                  <div>
                    <div className="text-zinc-500">Приглашения</div>
                    <div className="text-2xl font-semibold text-amber-400">
                      {invitations}
                    </div>
                  </div>
                )}
              </div>
            </div>
                        <div className="flex flex-col items-end gap-2">
              <Link
                href="/hero/invitations"
                className="text-xs text-zinc-500 hover:text-amber-400 transition"
              >
                Приглашения от компаний →
              </Link>
              <Link
                href={`/u/${hero.nickname}`}
                className="text-xs text-zinc-500 hover:text-amber-400 transition"
              >
                Публичный профиль →
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>

        {/* Артефакты */}
        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          АРТЕФАКТЫ · {myArtifacts.length}
        </h2>

        {myArtifacts.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-zinc-500 text-sm">
            Пока пусто. Победи босса — получишь свой первый артефакт.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myArtifacts.map((a) => {
              const item: LootItem = {
                id: a.id,
                slug: a.slug,
                name: a.name,
                description: a.description,
                icon: a.icon,
                rarity: a.rarity as LootItem['rarity'],
                isNew: false,
              };
              return <LootCard key={a.id} item={item} compact />;
            })}
          </div>
        )}

        {/* Достижения */}
        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          ДОСТИЖЕНИЯ · {myAchievements.length}
        </h2>

        {myAchievements.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-zinc-500 text-sm">
            Пока нет достижений. Победи босса — и откроются первые бейджи.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myAchievements.map((a) => {
              const item: EarnedAchievementItem = {
                id: a.id,
                slug: a.slug,
                name: a.name,
                description: a.description,
                icon: a.icon,
                xpReward: a.xpReward,
                goldReward: a.goldReward,
              };
              return <AchievementCard key={a.id} item={item} compact />;
            })}
          </div>
        )}

        {/* История походов */}
        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          ИСТОРИЯ ПОХОДОВ
        </h2>

        {mySubs.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-500 text-sm">
            Ты ещё не сдавал квесты. Пора начинать.{' '}
            <Link
              href="/quests"
              className="text-amber-400 hover:text-amber-300"
            >
              К доске квестов →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {mySubs.map((s) => {
              const pct = Math.round(
                (s.damageDealt / (s.bossMaxHp || 110)) * 100,
              );
              const victory = s.status === 'victory';
              const statusLabel = employerStatusLabel(s.employerStatus);

              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 ${
                    victory
                      ? 'border-emerald-800/40 bg-emerald-950/10'
                      : 'border-red-900/40 bg-red-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <Link
                      href={s.questSlug ? `/quests/${s.questSlug}` : '#'}
                      className="font-medium hover:text-amber-400"
                    >
                      {s.questTitle ?? 'Квест'}
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
                  <div className="text-xs text-zinc-500 font-mono truncate">
                    {s.repoUrl}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    {new Date(s.createdAt).toLocaleString('ru-RU')}
                  </div>

                  {s.employerStatus && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/60">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded border ${employerStatusStyle(
                          s.employerStatus,
                        )}`}
                      >
                        Работодатель: {statusLabel}
                      </span>
                      {s.employerNote && (
                        <div className="text-xs text-zinc-500 mt-1 italic">
                          «{s.employerNote}»
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}