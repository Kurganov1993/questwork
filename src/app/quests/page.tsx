import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quests, submissions } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { QuestCard } from '@/components/home/QuestCard';
import { TiltCard } from '@/components/animations/TiltCard';
import { HeroBackground } from '@/components/home/HeroBackground';
import { pluralWord } from '@/lib/plural';

export const dynamic = 'force-dynamic';

type Filter = 'all' | 'available' | 'cleared';
type Difficulty = 'any' | '1' | '2' | '3';

function parseFilter(value: string | undefined): Filter {
  if (value === 'available' || value === 'cleared') return value;
  return 'all';
}

function parseDifficulty(value: string | undefined): Difficulty {
  if (value === '1' || value === '2' || value === '3') return value;
  return 'any';
}

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; difficulty?: string; q?: string }>;
}) {
  const { filter: filterRaw, difficulty: diffRaw, q: qRaw } = await searchParams;
  const filter = parseFilter(filterRaw);
  const difficulty = parseDifficulty(diffRaw);
  const query = (qRaw ?? '').trim().toLowerCase();

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
    console.error('[quests] load failed:', (e as Error).message);
  }

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
      console.error('[quests] victories failed:', (e as Error).message);
    }
  }

  const totalQuests = allQuests.length;
  const clearedCount = allQuests.filter(
    (q) => (victoriesByQuest[q.id] ?? 0) > 0,
  ).length;

  const visibleQuests = allQuests.filter((q) => {
    const cleared = (victoriesByQuest[q.id] ?? 0) > 0;

    if (filter === 'cleared' && !cleared) return false;
    if (filter === 'available' && cleared) return false;

    if (difficulty !== 'any' && q.difficulty !== Number(difficulty)) {
      return false;
    }

    if (query) {
      const hay = `${q.title} ${q.description} ${q.bossName}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }

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

  const DIFFICULTIES: { value: Difficulty; label: string }[] = [
    { value: 'any', label: 'Любая' },
    { value: '1', label: '★' },
    { value: '2', label: '★★' },
    { value: '3', label: '★★★' },
  ];

  // Сохраняем параметры фильтрации для ссылок
  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      filter: filterRaw,
      difficulty: diffRaw,
      q: qRaw,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'all' && v !== 'any') params.set(k, v);
    }
    const s = params.toString();
    return s ? `/quests?${s}` : '/quests';
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
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
                  {totalQuests}{' '}
                  {pluralWord(totalQuests, [
                    'КВЕСТ',
                    'КВЕСТА',
                    'КВЕСТОВ',
                  ])}{' '}
                  ОТКРЫТО
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

          {/* Поиск */}
          <form
            action="/quests"
            method="get"
            className="mt-8 flex gap-3 flex-wrap"
          >
            <input
              type="text"
              name="q"
              defaultValue={qRaw ?? ''}
              placeholder="Поиск по названию, описанию, боссу…"
              className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 focus:border-amber-500/60 outline-none text-sm"
            />
            <input type="hidden" name="filter" value={filter} />
            <input type="hidden" name="difficulty" value={difficulty} />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-medium hover:bg-amber-500/25 transition"
            >
              Найти
            </button>
            {query && (
              <Link
                href={buildUrl({ q: undefined })}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-zinc-400 hover:border-white/20 transition"
              >
                Сброс
              </Link>
            )}
          </form>

          {/* Фильтры */}
          {hero && totalQuests > 0 && (
            <div className="mt-5 flex flex-wrap gap-4 items-center">
              <div className="flex gap-2 flex-wrap">
                {FILTERS.map((f) => {
                  const active = filter === f.value;
                  return (
                    <Link
                      key={f.value}
                      href={buildUrl({
                        filter: f.value === 'all' ? undefined : f.value,
                      })}
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

              <div className="h-6 w-px bg-white/10 hidden sm:block" />

              <div className="flex gap-2 flex-wrap">
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d.value;
                  return (
                    <Link
                      key={d.value}
                      href={buildUrl({
                        difficulty: d.value === 'any' ? undefined : d.value,
                      })}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition border ${
                        active
                          ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                          : 'border-zinc-800 text-zinc-400 hover:border-amber-500/60 hover:text-amber-400'
                      }`}
                    >
                      {d.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        {visibleQuests.length === 0 ? (
          <EmptyState
            filter={filter}
            totalQuests={totalQuests}
            hasQuery={!!query}
          />
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
    </main>
  );
}

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
  hasQuery,
}: {
  filter: Filter;
  totalQuests: number;
  hasQuery: boolean;
}) {
  if (hasQuery) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold mb-2">Ничего не найдено</h2>
        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
          Попробуй изменить запрос или сбросить фильтры.
        </p>
        <Link
          href="/quests"
          className="inline-block px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
        >
          Все квесты
        </Link>
      </div>
    );
  }

  if (totalQuests === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="text-xl font-semibold mb-2">Квестов пока нет</h2>
        <p className="text-zinc-400 mb-6 max-w-md mx-auto">
          Создай первый квест как работодатель — или загляни позже.
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
        <Link
          href="/quests"
          className="mt-6 inline-block px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
        >
          Показать все квесты
        </Link>
      </div>
    );
  }

  return null;
}