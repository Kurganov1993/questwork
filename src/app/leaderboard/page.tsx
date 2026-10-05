import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { heroes, submissions } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { HERO_CLASSES } from '@/lib/constants';
import { HeroBackground } from '@/components/home/HeroBackground';
import { HeroPodium } from '@/components/home/HeroPodium';

export const dynamic = 'force-dynamic';

type SortKey = 'level' | 'xp' | 'gold' | 'victories';

const SORT_LABELS: Record<SortKey, { label: string; icon: string }> = {
  level: { label: 'По уровню', icon: '🧙' },
  xp: { label: 'По XP', icon: '✨' },
  gold: { label: 'По золоту', icon: '🪙' },
  victories: { label: 'По победам', icon: '⚔️' },
};

function parseSort(value: string | undefined): SortKey {
  if (value === 'xp' || value === 'gold' || value === 'victories') return value;
  return 'level';
}

type Row = {
  id: number;
  nickname: string;
  heroClass: string;
  level: number;
  xp: number;
  gold: number;
  victories: number;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortRaw } = await searchParams;
  const sort = parseSort(sortRaw);
  const me = await getCurrentHero();

  let heroRows: Omit<Row, 'victories'>[] = [];
  try {
    heroRows = await withRetry(
      () =>
        db
          .select({
            id: heroes.id,
            nickname: heroes.nickname,
            heroClass: heroes.heroClass,
            level: heroes.level,
            xp: heroes.xp,
            gold: heroes.gold,
          })
          .from(heroes),
      { label: 'leaderboard:heroes' },
    );
  } catch (e) {
    console.error('[leaderboard] heroes failed:', (e as Error).message);
  }

  let victoryMap = new Map<number, number>();
  try {
    const victoryRows = await withRetry(
      () =>
        db
          .select({
            heroId: submissions.heroId,
            count: sql<number>`count(*)::int`,
          })
          .from(submissions)
          .where(eq(submissions.status, 'victory'))
          .groupBy(submissions.heroId),
      { label: 'leaderboard:victories' },
    );
    victoryMap = new Map(
      victoryRows.map((r) => [r.heroId, Number(r.count)]),
    );
  } catch (e) {
    console.error('[leaderboard] victories failed:', (e as Error).message);
  }

  const enriched: Row[] = heroRows.map((h) => ({
    id: h.id,
    nickname: h.nickname,
    heroClass: h.heroClass,
    level: h.level,
    xp: h.xp,
    gold: h.gold,
    victories: victoryMap.get(h.id) ?? 0,
  }));

  enriched.sort((a, b) => {
    switch (sort) {
      case 'xp':
        return b.xp - a.xp || b.level - a.level;
      case 'gold':
        return b.gold - a.gold || b.level - a.level;
      case 'victories':
        return b.victories - a.victories || b.level - a.level;
      case 'level':
      default:
        return b.level - a.level || b.xp - a.xp;
    }
  });

  const top3 = enriched.slice(0, 3);
  const rest = enriched.slice(3, 50);
  const myRank = me ? enriched.findIndex((r) => r.id === me.id) + 1 : 0;
  const myRow = myRank > 0 ? enriched[myRank - 1] : null;

  // Общая статистика платформы
  const totalHeroes = enriched.length;
  const totalXp = enriched.reduce((s, h) => s + h.xp, 0);
  const totalVictories = enriched.reduce((s, h) => s + h.victories, 0);
  const avgLevel =
    totalHeroes > 0
      ? Math.round(enriched.reduce((s, h) => s + h.level, 0) / totalHeroes)
      : 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-10">
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
                  СЕЗОН 1 · ТОП-50
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-3">
                Зал <span className="text-gradient-amber">славы</span>
              </h1>
              <p className="text-zinc-400 max-w-xl">
                Герои платформы по уровню, опыту, золоту и числу побед над
                боссами. Рейтинг обновляется в реальном времени.
              </p>
            </div>
          </div>

          {/* Статистика платформы */}
          {totalHeroes > 0 && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Героев"
                value={String(totalHeroes)}
                icon="🧙"
              />
              <StatCard
                label="Средний ур."
                value={String(avgLevel)}
                icon="📊"
              />
              <StatCard
                label="Всего XP"
                value={totalXp.toLocaleString('ru-RU')}
                icon="✨"
              />
              <StatCard
                label="Побед"
                value={String(totalVictories)}
                icon="⚔️"
                accent
              />
            </div>
          )}
        </div>
      </section>

      {/* ==================== МОЯ ПОЗИЦИЯ ==================== */}
      {me && myRow && (
        <section className="relative max-w-5xl mx-auto px-6 pb-8">
          <div className="glass-strong rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-amber-500/15 blur-[80px]" />

            <div className="relative flex items-center gap-4 flex-wrap">
              <div className="shrink-0">
                <div className="text-xs text-zinc-500 tracking-widest mb-1">
                  ТВОЯ ПОЗИЦИЯ
                </div>
                <div className="text-3xl font-bold text-gradient-amber">
                  #{myRank}
                </div>
              </div>

              <div className="h-12 w-px bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-3xl shrink-0">
                  {HERO_CLASSES.find((c) => c.value === myRow.heroClass)?.icon ??
                    '🧙'}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {myRow.nickname}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {HERO_CLASSES.find((c) => c.value === myRow.heroClass)
                      ?.label ?? myRow.heroClass}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 shrink-0">
                <MiniStat label="ур." value={String(myRow.level)} />
                <MiniStat label="XP" value={String(myRow.xp)} />
                <MiniStat label="🪙" value={String(myRow.gold)} />
                <MiniStat label="⚔️" value={String(myRow.victories)} />
              </div>

              <Link
                href="/hero"
                className="shrink-0 text-xs text-amber-400 hover:text-amber-300 transition"
              >
                К профилю →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ==================== ФИЛЬТРЫ ==================== */}
      <section className="relative max-w-5xl mx-auto px-6 pb-8">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
            const active = sort === key;
            const meta = SORT_LABELS[key];
            return (
              <Link
                key={key}
                href={`/leaderboard?sort=${key}`}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition border ${
                  active
                    ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                    : 'border-zinc-800 text-zinc-400 hover:border-amber-500/60 hover:text-amber-400'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ==================== ПОДИУМ ТОП-3 ==================== */}
      {top3.length > 0 && (
        <section className="relative max-w-5xl mx-auto px-6 pb-10">
          <HeroPodium
            heroes={top3.map((h) => ({
              id: h.id,
              nickname: h.nickname,
              heroClass: h.heroClass,
              level: h.level,
              xp: h.xp,
              gold: h.gold,
            }))}
          />
        </section>
      )}

      {/* ==================== СПИСОК 4-50 ==================== */}
      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        {enriched.length === 0 ? (
          <EmptyState />
        ) : rest.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-zinc-500 text-sm">
            Пока только {top3.length}{' '}
            {top3.length === 1 ? 'герой' : 'героя'} на платформе. Пригласи
            друзей!
          </div>
        ) : (
          <>
            <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3 mb-4">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
              МЕСТА 4 — {Math.min(50, enriched.length)}
            </h2>

            <div className="glass rounded-2xl overflow-hidden">
              {rest.map((r, idx) => {
                const place = idx + 4;
                const cls = HERO_CLASSES.find((c) => c.value === r.heroClass);
                const isMe = me?.id === r.id;

                return (
                  <RowItem
                    key={r.id}
                    row={r}
                    place={place}
                    sort={sort}
                    isMe={isMe}
                    clsIcon={cls?.icon ?? '🧙'}
                    clsLabel={cls?.label ?? r.heroClass}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

// ==================== ХЕЛПЕРЫ ====================

function StatCard({
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center min-w-[50px]">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function RowItem({
  row,
  place,
  sort,
  isMe,
  clsIcon,
  clsLabel,
}: {
  row: Row;
  place: number;
  sort: SortKey;
  isMe: boolean;
  clsIcon: string;
  clsLabel: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 transition ${
        isMe ? 'bg-amber-500/[0.06]' : 'hover:bg-white/[0.02]'
      }`}
    >
      <div className="w-10 text-center text-sm font-mono text-zinc-500 shrink-0">
        #{place}
      </div>

      <div className="text-2xl shrink-0">{clsIcon}</div>

      <Link
        href={`/u/${row.nickname}`}
        className="flex-1 min-w-0 hover:opacity-90 transition"
      >
        <div className="flex items-center gap-2">
          <span
            className={`font-medium truncate ${
              isMe ? 'text-amber-400' : ''
            }`}
          >
            {row.nickname}
          </span>
          {isMe && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              ты
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 truncate">{clsLabel}</div>
      </Link>

      <div className="flex gap-4 text-sm shrink-0">
        <Stat label="ур." value={row.level} active={sort === 'level'} />
        <Stat
          label="XP"
          value={row.xp}
          active={sort === 'xp'}
          minWidth="min-w-[56px]"
        />
        <Stat
          label="🪙"
          value={row.gold}
          active={sort === 'gold'}
          minWidth="min-w-[52px]"
        />
        <Stat
          label="побед"
          value={row.victories}
          active={sort === 'victories'}
          minWidth="min-w-[52px]"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  active,
  minWidth = 'min-w-[44px]',
}: {
  label: string;
  value: number;
  active: boolean;
  minWidth?: string;
}) {
  return (
    <div className={`text-center ${minWidth}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`font-semibold transition ${
          active ? 'text-amber-400' : 'text-zinc-200'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-12 text-center">
      <div className="text-5xl mb-4">🏆</div>
      <h2 className="text-xl font-semibold mb-2">Пока никто не зарегистрирован</h2>
      <p className="text-zinc-400 mb-6 max-w-md mx-auto">
        Стань первым героем платформы. Создай персонажа, пройди квест — и
        займи первое место в зале славы.
      </p>
      <Link
        href="/register"
        className="inline-block px-6 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)]"
      >
        Создать героя
      </Link>
    </div>
  );
}