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
  githubAccounts,
} from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { HERO_CLASSES } from '@/lib/constants';
import { LogoutButton } from '@/components/LogoutButton';
import { LootCard } from '@/components/LootCard';
import { AchievementCard } from '@/components/AchievementCard';
import { awardQuestArtifacts } from '@/lib/loot';
import { withRetry } from '@/lib/db-retry';
import { HeroBackground } from '@/components/home/HeroBackground';
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

  // Досылаем лут за прошлые победы — идемпотентно
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
          questIcon: quests.icon,
          bossName: quests.bossName,
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

  // GitHub-аккаунт (если подключён)
  let github: { username: string; avatarUrl: string | null } | null = null;
  try {
    const [gh] = await withRetry(
      () =>
        db
          .select({
            username: githubAccounts.githubUsername,
            avatarUrl: githubAccounts.avatarUrl,
          })
          .from(githubAccounts)
          .where(eq(githubAccounts.heroId, hero.id)),
      { label: 'hero:github-account' },
    );
    github = gh ?? null;
  } catch (e) {
    console.error('[hero] github failed:', (e as Error).message);
  }

  const victories = mySubs.filter((s) => s.status === 'victory').length;
  const defeats = mySubs.filter((s) => s.status === 'defeat').length;
  const totalAttempts = mySubs.length;
  const winRate =
    totalAttempts > 0 ? Math.round((victories / totalAttempts) * 100) : 0;

  const invitations = mySubs.filter(
    (s) => s.employerStatus === 'interview' || s.employerStatus === 'hired',
  ).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← На главную
          </Link>

          {/* Карточка героя */}
          <div className="mt-6 glass rounded-3xl p-7 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-amber-500/15 blur-[100px]" />

            <div className="relative flex flex-col sm:flex-row items-start gap-6">
              <div className="shrink-0 relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-500/5 border border-amber-500/40 grid place-items-center text-5xl drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]">
                  {cls?.icon ?? '🧙'}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 font-mono tracking-widest mb-1">
                  {cls?.label ?? hero.heroClass}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-4">
                  {hero.nickname}
                </h1>

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
                    label="Золото"
                    value={String(hero.gold)}
                    icon="🪙"
                  />
                  <StatCell
                    label="Победы"
                    value={String(victories)}
                    icon="⚔️"
                    accent
                  />
                  {invitations > 0 && (
                    <StatCell
                      label="Приглашения"
                      value={String(invitations)}
                      icon="🔔"
                      accent
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
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
                <Link
                  href="/hero/github"
                  className="text-xs text-zinc-500 hover:text-amber-400 transition"
                >
                  {github ? (
                    <>
                      🐙 @{github.username} →
                    </>
                  ) : (
                    <>🐙 Подключить GitHub →</>
                  )}
                </Link>
                <LogoutButton />
              </div>
            </div>
          </div>

          {/* Сводная статистика */}
          {totalAttempts > 0 && (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryStat
                label="Попыток"
                value={String(totalAttempts)}
                icon="🎯"
              />
              <SummaryStat
                label="Побед"
                value={String(victories)}
                icon="🏆"
                accent
              />
              <SummaryStat
                label="Win rate"
                value={`${winRate}%`}
                icon="📊"
              />
              <SummaryStat
                label="Поражений"
                value={String(defeats)}
                icon="💀"
              />
            </div>
          )}

          {/* CTA подключить GitHub */}
          {!github && (
            <div className="mt-5 glass rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-violet-500/15 blur-[80px]" />

              <div className="relative flex items-center justify-between gap-5 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="text-3xl shrink-0">🐙</div>
                  <div>
                    <div className="font-semibold mb-1">
                      Подключи GitHub
                    </div>
                    <div className="text-xs text-zinc-500 max-w-lg">
                      Сдавай квесты в один клик — выбирай репозиторий из
                      списка, без копирования ссылок.
                    </div>
                  </div>
                </div>
                <a
                  href="/api/auth/github"
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 transition text-sm font-medium"
                >
                  Подключить →
                </a>
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
            text="Победи босса — получишь свой первый артефакт."
            cta={{ href: '/quests', label: 'К доске квестов' }}
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
            text="Победи босса — и откроются первые бейджи."
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
        <SectionLabel>ИСТОРИЯ ПОХОДОВ · {totalAttempts}</SectionLabel>

        {mySubs.length === 0 ? (
          <EmptyBlock
            icon="📜"
            title="Ты ещё не сдавал квесты"
            text="Пора начинать. Возьми первый квест и сдай GitHub-репозиторий."
            cta={{ href: '/quests', label: 'К доске квестов' }}
          />
        ) : (
          <div className="space-y-3" data-cascade>
            {mySubs.map((s) => {
              const pct = Math.round(
                (s.damageDealt / (s.bossMaxHp || 110)) * 100,
              );
              const victory = s.status === 'victory';
              const statusLabel = employerStatusLabel(s.employerStatus);

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
                        <Link
                          href={s.questSlug ? `/quests/${s.questSlug}` : '#'}
                          className="font-semibold hover:text-amber-400 transition"
                        >
                          {s.questTitle ?? 'Квест'}
                        </Link>
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

                    <div className="shrink-0 w-24 sm:w-32">
                      <div className="text-xs text-zinc-500 mb-1 text-right">
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

                  {s.employerStatus && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full border ${employerStatusStyle(
                          s.employerStatus,
                        )}`}
                      >
                        Работодатель: {statusLabel}
                      </span>
                      {s.employerNote && (
                        <div className="text-xs text-zinc-500 mt-1.5 italic border-l-2 border-zinc-700/60 pl-3">
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
      </section>
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

function SummaryStat({
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
    <div className="glass rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <span>{icon}</span>
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
  cta,
}: {
  icon: string;
  title: string;
  text: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="glass rounded-2xl p-8 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-zinc-500 mb-4 max-w-md mx-auto">{text}</div>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block px-5 py-2.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition text-sm font-medium"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}