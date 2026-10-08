import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quests, submissions, heroes } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { countUnseenNotifications } from '@/lib/notifications';
import { withRetry } from '@/lib/db-retry';
import { HERO_CLASSES } from '@/lib/constants';
import { plural, pluralize } from '@/lib/plural';
import { HeroBackground } from '@/components/home/HeroBackground';
import { TiltCard } from '@/components/animations/TiltCard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  const cls = HERO_CLASSES.find((c) => c.value === hero.heroClass);

  const [myQuestStats, clearedQuestIds, activeQuests, topHeroes, unseen] =
    await Promise.all([
      // Группировка походов по квестам: одна строка на уникальный квест
      withRetry(
        () =>
          db
            .select({
              questId: quests.id,
              slug: quests.slug,
              title: quests.title,
              icon: quests.icon,
              bossMaxHp: quests.bossMaxHp,
              total: sql<number>`count(${submissions.id})::int`,
              best: sql<number>`coalesce(max(${submissions.damageDealt}), 0)::int`,
              victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
              lastAt: sql<string>`max(${submissions.createdAt})::text`,
            })
            .from(submissions)
            .innerJoin(quests, eq(quests.id, submissions.questId))
            .where(eq(submissions.heroId, hero.id))
            .groupBy(
              quests.id,
              quests.slug,
              quests.title,
              quests.icon,
              quests.bossMaxHp,
            )
            .orderBy(desc(sql`max(${submissions.createdAt})`))
            .limit(5),
        { label: 'dashboard:quest-stats' },
      ).catch(() => []),

      // Квесты, где герой уже побеждал
      withRetry(
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
        { label: 'dashboard:cleared' },
      ).catch(() => []),

      // Все активные квесты
      withRetry(
        () =>
          db
            .select()
            .from(quests)
            .where(eq(quests.status, 'active'))
            .orderBy(quests.difficulty),
        { label: 'dashboard:active-quests' },
      ).catch(() => []),

      // Топ-3 героя
      withRetry(
        () =>
          db
            .select({
              id: heroes.id,
              nickname: heroes.nickname,
              heroClass: heroes.heroClass,
              level: heroes.level,
              xp: heroes.xp,
            })
            .from(heroes)
            .orderBy(desc(heroes.xp), desc(heroes.level))
            .limit(3),
        { label: 'dashboard:top-heroes' },
      ).catch(() => []),

      countUnseenNotifications(hero.id).catch(() => 0),
    ]);

  const clearedSet = new Set(clearedQuestIds.map((c) => c.questId));

  const allAvailable = activeQuests.filter((q) => !clearedSet.has(q.id));
  const totalAvailable = allAvailable.length;
  const availableQuests = allAvailable.slice(0, 3);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HEADER ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-10">
          <div className="glass rounded-3xl p-7 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-amber-500/15 blur-[100px]" />

            <div className="relative flex flex-col sm:flex-row items-start gap-6">
              <div className="shrink-0 relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-500/5 border border-amber-500/40 grid place-items-center text-4xl drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]">
                  {cls?.icon ?? '🧙'}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 font-mono tracking-widest mb-1">
                  {cls?.label ?? hero.heroClass}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                  Привет, {hero.nickname}
                </h1>

                <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
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
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <Link
                  href="/quests"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition shadow-[0_0_30px_-10px_rgba(251,191,36,0.5)]"
                >
                  Найти квест →
                </Link>
                <Link
                  href="/hero"
                  className="text-xs text-zinc-500 hover:text-amber-400 transition"
                >
                  Открыть профиль →
                </Link>
              </div>
            </div>
          </div>

          {unseen > 0 && (
            <Link
              href="/hero/invitations"
              className="mt-4 flex items-center justify-between gap-4 glass rounded-2xl p-5 border-l-2 border-l-amber-500/60 hover:bg-white/[0.03] transition group"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">🔔</span>
                <div>
                  <div className="font-semibold mb-1">
                    Приглашения от компаний
                  </div>
                  <div className="text-xs text-zinc-500">
                    {unseen} новых
                  </div>
                </div>
              </div>
              <span className="text-amber-400 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* ==================== ДОСТУПНЫЕ КВЕСТЫ ==================== */}
      <section className="relative max-w-5xl mx-auto px-6 pb-10">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <SectionLabel>ДОСТУПНЫЕ КВЕСТЫ</SectionLabel>
          <Link
            href="/quests"
            className="text-xs text-amber-400 hover:text-amber-300 transition"
          >
            все квесты →
          </Link>
        </div>

        {availableQuests.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <div className="font-semibold mb-1">
              Ты прошёл все доступные квесты
            </div>
            <div className="text-sm text-zinc-500 mb-4">
              Смотри профиль или дождись новых квестов от работодателей.
            </div>
            <Link
              href="/hero"
              className="inline-block px-5 py-2.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition text-sm font-medium"
            >
              Мой профиль
            </Link>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-4" data-cascade>
              {availableQuests.map((q) => (
                <div key={q.id} data-cascade-item>
                  <TiltCard max={3}>
                    <Link
                      href={`/quests/${q.slug}`}
                      className="block glass card-glow rounded-2xl p-5 h-full group"
                    >
                      <div className="text-4xl mb-3">{q.icon}</div>
                      <div className="text-xs text-amber-400 mb-1 font-mono">
                        {'★'.repeat(q.difficulty)}
                      </div>
                      <div className="font-semibold mb-2 group-hover:text-amber-400 transition line-clamp-2">
                        {q.title}
                      </div>
                      <div className="text-xs text-zinc-500">
                        👑 {q.bossName}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        ✨ {q.rewardXp} XP · 🪙 {q.rewardGold}
                      </div>
                    </Link>
                  </TiltCard>
                </div>
              ))}
            </div>

            {totalAvailable > 3 && (
              <div className="text-center mt-5">
                <Link
                  href="/quests"
                  className="text-xs text-amber-400 hover:text-amber-300 transition"
                >
                  ещё {totalAvailable - 3}{' '}
                  {plural(totalAvailable - 3, [
                    'квест',
                    'квеста',
                    'квестов',
                  ])}{' '}
                  →
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* ==================== ПОСЛЕДНИЕ ПОХОДЫ ==================== */}
      <section className="relative max-w-5xl mx-auto px-6 pb-10">
        <SectionLabel>ПОСЛЕДНИЕ ПОХОДЫ</SectionLabel>

        {myQuestStats.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">📜</div>
            <div className="font-semibold mb-1">Ты ещё не сдавал квесты</div>
            <div className="text-sm text-zinc-500 mb-4">
              Возьми первый квест и сдай GitHub-репозиторий.
            </div>
            <Link
              href="/quests"
              className="inline-block px-5 py-2.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition text-sm"
            >
              К доске квестов
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {myQuestStats.map((s) => {
              const hasVictory = Number(s.victories) > 0;
              const bestPct = Math.round(
                (Number(s.best) / (s.bossMaxHp || 110)) * 100,
              );
              const total = Number(s.total);
              return (
                <div
                  key={s.questId}
                  className={`glass rounded-xl p-4 flex items-center gap-4 border-l-2 ${
                    hasVictory
                      ? 'border-l-emerald-500/60'
                      : 'border-l-red-500/60'
                  }`}
                >
                  <span className="text-2xl shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <Link
                        href={`/quests/${s.slug}`}
                        className="font-medium hover:text-amber-400 transition truncate"
                      >
                        {s.title}
                      </Link>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          hasVictory
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40'
                            : 'bg-red-500/15 text-red-300 border-red-700/40'
                        }`}
                      >
                        {hasVictory ? '✓ победа' : '✗ без победы'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {total} {plural(total, ['попытка', 'попытки', 'попыток'])}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="text-zinc-300 font-semibold">
                      лучший {bestPct}%
                    </div>
                    <div className="text-zinc-500 font-mono">
                      {Number(s.best)} / {s.bossMaxHp}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-center pt-2">
              <Link
                href="/hero"
                className="text-xs text-zinc-500 hover:text-amber-400 transition"
              >
                вся история →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ==================== ТОП ГЕРОЕВ ==================== */}
      {topHeroes.length > 0 && (
        <section className="relative max-w-5xl mx-auto px-6 pb-20">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <SectionLabel>ТОП ГЕРОЕВ</SectionLabel>
            <Link
              href="/leaderboard"
              className="text-xs text-amber-400 hover:text-amber-300 transition"
            >
              весь рейтинг →
            </Link>
          </div>

          <div className="space-y-2">
            {topHeroes.map((h, i) => {
              const hcls = HERO_CLASSES.find((c) => c.value === h.heroClass);
              const medal =
                i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
              const isMe = h.nickname === hero.nickname;
              return (
                <Link
                  key={h.id}
                  href={`/u/${h.nickname}`}
                  className={`glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.03] transition ${
                    isMe ? 'ring-1 ring-amber-500/40' : ''
                  }`}
                >
                  <span className="text-2xl shrink-0 w-8 text-center">
                    {medal}
                  </span>
                  <span className="text-2xl shrink-0">
                    {hcls?.icon ?? '🧙'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {h.nickname}
                      {isMe && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          ты
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {hcls?.label ?? h.heroClass}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="text-amber-400 font-semibold">
                      ур. {h.level}
                    </div>
                    <div className="text-zinc-500">{h.xp} XP</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3">
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
      {children}
    </h2>
  );
}