import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quests, submissions } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { QuestCard } from '@/components/home/QuestCard';
import { TiltCard } from '@/components/animations/TiltCard';
import { HeroBackground } from '@/components/home/HeroBackground';

export const dynamic = 'force-dynamic';

type Filter = 'all' | 'available' | 'cleared';

function parseFilter(value: string | undefined): Filter {
  if (value === 'available' || value === 'cleared') return value;
  return 'all';
}

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterRaw } = await searchParams;
  const filter = parseFilter(filterRaw);
  const hero = await getCurrentHero();

  let allQuests: (typeof quests.$inferSelect)[] = [];
  try {
    allQuests = await withRetry(
      () =>
        db
          .select()
          .from(quests)
          .where(eq(quests.status, 'active'))
          .orderBy(quests.difficulty),
      { label: 'quests:list' },
    );
  } catch (e) {
    console.error('[quests] не удалось загрузить квесты:', (e as Error).message);
  }

  // Победы текущего героя по квестам
  let victoriesByQuest: Record<number, number> = {};
  if (hero && allQuests.length > 0) {
    try {
      const rows = await withRetry(
        () =>
          db
            .select({
              questId: submissions.questId,
              count: sql<number>`count(*)::int`,
            })
            .from(submissions)
            .where(eq(submissions.heroId, hero.id))
            .groupBy(submissions.questId),
        { label: 'quests:victories' },
      );
      victoriesByQuest = Object.fromEntries(
        rows.map((r) => [r.questId, Number(r.count)]),
      );
    } catch (e) {
      console.error(
        '[quests] не удалось загрузить победы героя:',
        (e as Error).message,
      );
    }
  }

  const totalQuests = allQuests.length;
  const clearedCount = allQuests.filter(
    (q) => (victoriesByQuest[q.id] ?? 0) > 0,
  ).length;

  const visibleQuests = allQuests.filter((q) => {
    const cleared = (victoriesByQuest[q.id] ?? 0) > 0;
    if (filter === 'cleared') return cleared;
    if (filter === 'available') return !cleared;
    return true;
  });

  const totalXpAvailable = visibleQuests.reduce(
    (sum, q) => sum + q.rewardXp,
    0,
  );

  const FILTERS: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'Все', count: totalQuests },
    {
      value: 'available',
      label: 'Доступные',
      count: totalQuests - clearedCount,
    },
    { value: 'cleared', label: 'Пройденные', count: clearedCount },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← На главную
          </Link>

          <div className="mt-6 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-amber-300 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                <span className="tracking-widest font-mono">
                  {totalQuests} КВЕСТОВ ОТКРЫТО
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-3">
                Доска <span className="text-gradient-amber">квестов</span>
              </h1>
              <p className="text-zinc-400 max-w-xl">
                Возьми задачу, сдай GitHub-репозиторий, победи босса. Каждая
                сдача проходит через Docker, ESLint и AI-ревью.
              </p>
            </div>

            {/* Статистика справа */}
            {hero && (
              <div className="flex gap-3 flex-wrap">
                <MiniStat
                  label="Пройдено"
                  value={`${clearedCount}/${totalQuests}`}
                  icon="✔"
                  accent
                />
                <MiniStat
                  label="Доступно XP"
                  value={totalXpAvailable.toLocaleString('ru-RU')}
                  icon="✨"
                />
              </div>
            )}
          </div>

          {/* Фильтры */}
          {hero && totalQuests > 0 && (
            <div className="mt-8 flex gap-2 flex-wrap">
              {FILTERS.map((f) => {
                const active = filter === f.value;
                return (
                  <Link
                    key={f.value}
                    href={
                      f.value === 'all'
                        ? '/quests'
                        : `/quests?filter=${f.value}`
                    }
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition border ${
                      active
                        ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                        : 'border-zinc-800 text-zinc-400 hover:border-amber-500/60 hover:text-amber-400'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        active
                          ? 'bg-black/20 text-black'
                          : 'bg-white/5 text-zinc-500'
                      }`}
                    >
                      {f.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ==================== СПИСОК ==================== */}
      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        {visibleQuests.length === 0 ? (
          <EmptyState filter={filter} totalQuests={totalQuests} />
        ) : (
          <div className="space-y-4" data-cascade>
            {visibleQuests.map((q) => (
              <div key={q.id} data-cascade-item data-reveal>
                <TiltCard max={3}>
                  <QuestCard
                    quest={q}
                    cleared={(victoriesByQuest[q.id] ?? 0) > 0}
                  />
                </TiltCard>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================== НИЖНИЙ CTA ==================== */}
      <section className="relative max-w-4xl mx-auto px-6 pb-20">
        <div className="relative glass-strong rounded-3xl p-10 text-center overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/20 blur-[100px] animate-pulse-glow" />

          <div className="relative">
            <div className="text-4xl mb-4">🏢</div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Хочешь создать свой квест?
            </h2>
            <p className="text-zinc-400 mb-6 max-w-lg mx-auto">
              Опиши задачу, задай критерии проверки — и герои начнут её
              проходить. Автоматическая проверка через Docker, ESLint и AI.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/employer/register"
                className="px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)]"
              >
                Стать работодателем
              </Link>
              <Link
                href="/leaderboard"
                className="px-6 py-3 rounded-lg glass hover:bg-white/5 font-semibold transition"
              >
                Смотреть лидерборд
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ==================== ХЕЛПЕРЫ ====================

function MiniStat({
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
    <div className="glass rounded-xl px-4 py-3 min-w-[130px]">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <span>{icon}</span>
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div
        className={`text-xl font-bold ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  filter,
  totalQuests,
}: {
  filter: Filter;
  totalQuests: number;
}) {
  if (totalQuests === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="text-xl font-semibold mb-2">Квестов пока нет</h2>
        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
          Платформа только запускается. Создай первый квест как работодатель —
          или загляни позже.
        </p>
        <Link
          href="/employer/register"
          className="inline-block px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
        >
          Создать квест
        </Link>
      </div>
    );
  }

  if (filter === 'cleared') {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">🎯</div>
        <h2 className="text-xl font-semibold mb-2">Ты ещё ничего не прошёл</h2>
        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
          Возьми первый квест — сдай репозиторий и победи босса.
        </p>
        <Link
          href="/quests"
          className="inline-block px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
        >
          Показать все квесты
        </Link>
      </div>
    );
  }

  if (filter === 'available') {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">👑</div>
        <h2 className="text-xl font-semibold mb-2">
          Все квесты пройдены
        </h2>
        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
          Ты победил всех доступных боссов. Смотри прогресс в профиле или
          дождись новых квестов.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/hero"
            className="px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            Мой профиль
          </Link>
          <Link
            href="/leaderboard"
            className="px-6 py-3 rounded-lg glass hover:bg-white/5 font-semibold transition"
          >
            Лидерборд
          </Link>
        </div>
      </div>
    );
  }

  return null;
}