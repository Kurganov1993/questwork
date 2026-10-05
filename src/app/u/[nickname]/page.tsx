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
import { withRetry } from '@/lib/db-retry';
import { HERO_CLASSES } from '@/lib/constants';
import { LootCard } from '@/components/LootCard';
import { AchievementCard } from '@/components/AchievementCard';
import { HeroBackground } from '@/components/home/HeroBackground';
import { CopyLinkButton } from '@/components/CopyLinkButton';
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
    description: `Профиль героя ${hero.nickname} на QuestWork. Артефакты, достижения, история походов.`,
  };
}

export default async function PublicHeroPage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname } = await params;

  let hero: typeof heroes.$inferSelect | undefined;
  try {
    const rows = await withRetry(
      () => db.select().from(heroes).where(eq(heroes.nickname, nickname)),
      { label: 'public-hero:get' },
    );
    hero = rows[0];
  } catch (e) {
    console.error('[public-hero] failed:', (e as Error).message);
  }

  if (!hero) notFound();

  const cls = HERO_CLASSES.find((c) => c.value === hero.heroClass);

  const subs = await withRetry(
    () =>
      db
        .select({
          id: submissions.id,
          repoUrl: submissions.repoUrl,
          status: submissions.status,
          damageDealt: submissions.damageDealt,
          createdAt: submissions.createdAt,
          questTitle: quests.title,
          questSlug: quests.slug,
          questIcon: quests.icon,
          bossName: quests.bossName,
          bossMaxHp: quests.bossMaxHp,
        })
        .from(submissions)
        .leftJoin(quests, eq(quests.id, submissions.questId))
        .where(eq(submissions.heroId, hero.id))
        .orderBy(desc(submissions.createdAt))
        .limit(20),
    { label: 'public-hero:subs' },
  ).catch(() => []);

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
    { label: 'public-hero:artifacts' },
  ).catch(() => []);

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
    { label: 'public-hero:achievements' },
  ).catch(() => []);

  let stats = { victories: 0, defeats: 0, total: 0 };
  try {
    const [row] = await withRetry(
      () =>
        db
          .select({
            victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
            defeats: sql<number>`count(*) filter (where ${submissions.status} = 'defeat')::int`,
            total: sql<number>`count(*)::int`,
          })
          .from(submissions)
          .where(eq(submissions.heroId, hero.id)),
      { label: 'public-hero:stats' },
    );
    stats = {
      victories: Number(row?.victories ?? 0),
      defeats: Number(row?.defeats ?? 0),
      total: Number(row?.total ?? 0),
    };
  } catch (e) {
    console.error('[public-hero] stats failed:', (e as Error).message);
  }

  const uniqueBosses = await withRetry(
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
    { label: 'public-hero:unique-bosses' },
  ).catch(() => []);

  const winRate =
    stats.total > 0 ? Math.round((stats.victories / stats.total) * 100) : 0;

  const registeredAt = new Date(hero.createdAt).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isPortfolioReady =
    myArtifacts.length > 0 || myAchievements.length > 0 || stats.victories > 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-10">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
            >
              ← Лидерборд
            </Link>
            <CopyLinkButton />
          </div>

          {/* Карточка героя */}
          <div className="glass rounded-3xl p-7 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-amber-500/15 blur-[100px]" />

            <div className="relative flex flex-col sm:flex-row items-start gap-6">
              {/* Аватар класса */}
              <div className="shrink-0">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-500/5 border border-amber-500/40 grid place-items-center text-5xl drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]">
                  {cls?.icon ?? '🧙'}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 font-mono tracking-widest mb-1">
                  {cls?.label ?? hero.heroClass}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-1">
                  {hero.nickname}
                </h1>
                <div className="text-xs text-zinc-500 mb-5">
                  В гильдии с {registeredAt}
                </div>

                {/* Основные статы */}
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <StatCell
                    label="Уровень"
                    value={String(hero.level)}
                    icon="🧙"
                    accent
                  />
                  <StatCell
                    label="XP"
                    value={hero.xp.toLocaleString('ru-RU')}
                    icon="✨"
                  />
                  <StatCell
                    label="Победы"
                    value={String(stats.victories)}
                    icon="⚔️"
                    accent
                  />
                  <StatCell
                    label="Win rate"
                    value={`${winRate}%`}
                    icon="📊"
                  />
                  <StatCell
                    label="Боссов"
                    value={String(uniqueBosses.length)}
                    icon="👑"
                  />
                </div>
              </div>
            </div>

            {/* Дополнительная сетка статов */}
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/5">
              <MiniStat
                label="Всего заходов"
                value={String(stats.total)}
                icon="🎯"
              />
              <MiniStat
                label="Побед"
                value={String(stats.victories)}
                icon="🏆"
                color="emerald"
              />
              <MiniStat
                label="Поражений"
                value={String(stats.defeats)}
                icon="💀"
                color="red"
              />
              <MiniStat
                label="Золото"
                value={String(hero.gold)}
                icon="🪙"
                color="amber"
              />
            </div>
          </div>

          {/* CTA для работодателей */}
          {isPortfolioReady && (
            <div className="mt-5 glass rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-violet-500/15 blur-[80px]" />

              <div className="relative flex items-center justify-between gap-5 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="text-3xl shrink-0">🏢</div>
                  <div>
                    <div className="font-semibold mb-1">
                      Ищете разработчика с таким профилем?
                    </div>
                    <div className="text-xs text-zinc-500 max-w-lg">
                      Все артефакты и достижения заработаны на реальных
                      задачах: код собирается в Docker, проходит тесты и
                      AI-ревью.
                    </div>
                  </div>
                </div>
                <Link
                  href="/employer/register"
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 transition text-sm font-medium"
                >
                  Создать квест →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ==================== АРТЕФАКТЫ ==================== */}
      <section className="relative max-w-4xl mx-auto px-6 pb-10">
        <SectionLabel>АРТЕФАКТЫ · {myArtifacts.length}</SectionLabel>

        {myArtifacts.length === 0 ? (
          <EmptyBlock
            icon="💎"
            title="Пока пусто"
            text="Герой ещё не добыл ни одного артефакта."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-cascade>
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
              return (
                <div key={a.id} data-cascade-item>
                  <LootCard item={item} compact />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== ДОСТИЖЕНИЯ ==================== */}
      <section className="relative max-w-4xl mx-auto px-6 pb-10">
        <SectionLabel>ДОСТИЖЕНИЯ · {myAchievements.length}</SectionLabel>

        {myAchievements.length === 0 ? (
          <EmptyBlock
            icon="🏆"
            title="Пока нет достижений"
            text="Герой ещё не открыл ни одного бейджа."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-cascade>
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
              return (
                <div key={a.id} data-cascade-item>
                  <AchievementCard item={item} compact />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== ИСТОРИЯ ПОХОДОВ ==================== */}
      <section className="relative max-w-4xl mx-auto px-6 pb-20">
        <SectionLabel>
          ИСТОРИЯ ПОХОДОВ · {subs.length}
        </SectionLabel>

        {subs.length === 0 ? (
          <EmptyBlock
            icon="📜"
            title="Герой пока не сдавал квесты"
            text="Как только он возьмёт первый квест, здесь появится его история."
          />
        ) : (
          <div className="space-y-3" data-cascade>
            {subs.map((s) => {
              const pct = Math.round(
                (s.damageDealt / (s.bossMaxHp || 110)) * 100,
              );
              const victory = s.status === 'victory';

              return (
                <div
                  key={s.id}
                  data-cascade-item
                  className={`glass rounded-2xl p-5 relative overflow-hidden ${
                    victory
                      ? 'border-l-2 border-l-emerald-500/60'
                      : 'border-l-2 border-l-red-500/60'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="text-3xl shrink-0">
                      {s.questIcon ?? (victory ? '⚔️' : '💀')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        {s.questSlug ? (
                          <Link
                            href={`/quests/${s.questSlug}`}
                            className="font-semibold hover:text-amber-400 transition"
                          >
                            {s.questTitle ?? 'Квест'}
                          </Link>
                        ) : (
                          <span className="font-semibold">
                            {s.questTitle ?? 'Квест'}
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            victory
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40'
                              : 'bg-red-500/15 text-red-300 border-red-700/40'
                          }`}
                        >
                          {victory ? '✓ победа' : '✗ поражение'}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {pct}% урона
                        </span>
                      </div>

                      {s.bossName && (
                        <div className="text-xs text-zinc-500 mb-2">
                          👑 {s.bossName}
                        </div>
                      )}

                      <a
                        href={s.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 font-mono truncate block hover:text-amber-400 transition"
                      >
                        {s.repoUrl}
                      </a>

                      <div className="text-xs text-zinc-600 mt-1">
                        {new Date(s.createdAt).toLocaleString('ru-RU')}
                      </div>
                    </div>

                    {/* Прогресс урона */}
                    <div className="shrink-0 w-24 sm:w-32">
                      <div className="text-xs text-zinc-500 mb-1 text-right font-mono">
                        {s.damageDealt} / {s.bossMaxHp}
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            victory
                              ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-400'
                              : 'bg-gradient-to-r from-red-500/60 to-red-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-md bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-400 font-bold text-sm">
              Q
            </div>
            <span className="font-semibold tracking-wide">QUESTWORK</span>
          </div>
          <div className="text-xs text-zinc-600 mb-4">
            Профиль сгенерирован автоматически · найм как рейд
          </div>
          <div className="flex items-center justify-center gap-4 text-xs">
            <Link
              href="/leaderboard"
              className="text-zinc-500 hover:text-amber-400 transition"
            >
              Лидерборд
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/quests"
              className="text-zinc-500 hover:text-amber-400 transition"
            >
              Квесты
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/employer/register"
              className="text-zinc-500 hover:text-amber-400 transition"
            >
              Работодателям
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ==================== ХЕЛПЕРЫ ====================

function StatCell({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-0.5">
        <span className="opacity-70">{icon}</span>
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div
        className={`text-2xl font-bold ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  color = 'zinc',
}: {
  label: string;
  value: string;
  icon: string;
  color?: 'zinc' | 'amber' | 'emerald' | 'red';
}) {
  const valueColor = {
    zinc: 'text-zinc-100',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
  }[color];

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
      <div className="text-xs text-zinc-500 mb-1 flex items-center justify-center gap-1.5">
        <span>{icon}</span>
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div className={`text-xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3 mb-4">
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
      {children}
    </h2>
  );
}

function EmptyBlock({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="glass rounded-2xl p-8 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-zinc-500 max-w-md mx-auto">{text}</div>
    </div>
  );
}