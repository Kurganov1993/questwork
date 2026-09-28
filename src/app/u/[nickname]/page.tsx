import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  heroes,
  submissions,
  quests,
  heroArtifacts,
  artifacts,
  heroAchievements,
  achievements as achievementsTable,
} from '@/db/schema';
import { HERO_CLASSES } from '@/lib/constants';
import { LootCard } from '@/components/LootCard';
import { AchievementCard } from '@/components/AchievementCard';
import type { LootItem, EarnedAchievementItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname } = await params;
  const [hero] = await db
    .select({ nickname: heroes.nickname, level: heroes.level })
    .from(heroes)
    .where(eq(heroes.nickname, nickname));

  if (!hero) return { title: 'Герой не найден · QuestWork' };
  return {
    title: `${hero.nickname} · ур. ${hero.level} · QuestWork`,
    description: `Профиль героя ${hero.nickname} на QuestWork.`,
  };
}

export default async function PublicHeroPage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname } = await params;

  const [hero] = await db
    .select()
    .from(heroes)
    .where(eq(heroes.nickname, nickname));

  if (!hero) notFound();

  const cls = HERO_CLASSES.find((c) => c.value === hero.heroClass);

  const subs = await db
    .select({
      id: submissions.id,
      repoUrl: submissions.repoUrl,
      status: submissions.status,
      damageDealt: submissions.damageDealt,
      createdAt: submissions.createdAt,
      questTitle: quests.title,
      questSlug: quests.slug,
      bossMaxHp: quests.bossMaxHp,
    })
    .from(submissions)
    .leftJoin(quests, eq(quests.id, submissions.questId))
    .where(eq(submissions.heroId, hero.id))
    .orderBy(desc(submissions.createdAt))
    .limit(20);

  const myArtifacts = await db
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
    .orderBy(desc(heroArtifacts.earnedAt));

  const myAchievements = await db
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
    .orderBy(desc(heroAchievements.earnedAt));

  const [stats] = await db
    .select({
      victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
      defeats: sql<number>`count(*) filter (where ${submissions.status} = 'defeat')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(submissions)
    .where(eq(submissions.heroId, hero.id));

  const totalSubs = Number(stats?.total ?? 0);
  const victoriesCount = Number(stats?.victories ?? 0);
  const defeatsCount = Number(stats?.defeats ?? 0);
  const winRate =
    totalSubs > 0 ? Math.round((victoriesCount / totalSubs) * 100) : 0;

  const uniqueBosses = await db
    .select({ questId: submissions.questId })
    .from(submissions)
    .where(
      and(
        eq(submissions.heroId, hero.id),
        eq(submissions.status, 'victory'),
      ),
    )
    .groupBy(submissions.questId);

  const registeredAt = new Date(hero.createdAt).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/leaderboard" className="text-sm text-zinc-500 hover:text-amber-400">
          ← Лидерборд
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-start gap-5">
            <div className="text-6xl">{cls?.icon ?? '🧙'}</div>
            <div className="flex-1">
              <div className="text-sm text-zinc-500">
                {cls?.label ?? hero.heroClass}
              </div>
              <h1 className="text-3xl font-bold">{hero.nickname}</h1>
              <div className="text-xs text-zinc-500 mt-1">
                В гильдии с {registeredAt}
              </div>

              <div className="flex flex-wrap gap-6 mt-4 text-sm">
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
                  <div className="text-zinc-500">Победы</div>
                  <div className="text-2xl font-semibold text-emerald-400">
                    {victoriesCount}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Win rate</div>
                  <div className="text-2xl font-semibold">{winRate}%</div>
                </div>
                <div>
                  <div className="text-zinc-500">Боссов</div>
                  <div className="text-2xl font-semibold">
                    {uniqueBosses.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-800/60 text-xs">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-center">
              <div className="text-zinc-500 mb-1">Всего заходов</div>
              <div className="text-lg font-semibold">{totalSubs}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-center">
              <div className="text-zinc-500 mb-1">Побед</div>
              <div className="text-lg font-semibold text-emerald-400">
                {victoriesCount}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-center">
              <div className="text-zinc-500 mb-1">Поражений</div>
              <div className="text-lg font-semibold text-red-400">
                {defeatsCount}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-center">
              <div className="text-zinc-500 mb-1">Золото</div>
              <div className="text-lg font-semibold">🪙 {hero.gold}</div>
            </div>
          </div>
        </div>

        {/* Артефакты */}
        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          АРТЕФАКТЫ · {myArtifacts.length}
        </h2>

        {myArtifacts.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-zinc-500 text-sm">
            Герой ещё не добыл ни одного артефакта.
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
            Пока нет достижений.
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

        {subs.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-500 text-sm">
            Герой пока не сдавал квесты.
          </div>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => {
              const pct = Math.round(
                (s.damageDealt / (s.bossMaxHp || 110)) * 100,
              );
              const victory = s.status === 'victory';
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
                      href={`/quests/${s.questSlug}`}
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
                  <a
                    href={s.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-500 font-mono truncate block hover:text-amber-400"
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

        <footer className="mt-12 pt-6 border-t border-zinc-800/60 text-center text-xs text-zinc-600">
          Профиль сгенерирован QuestWork · найм как рейд
        </footer>
      </div>
    </main>
  );
}