import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { heroes, submissions } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { HERO_CLASSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type SortKey = 'level' | 'xp' | 'gold' | 'victories';

const SORT_LABELS: Record<SortKey, string> = {
  level: 'По уровню',
  xp: 'По XP',
  gold: 'По золоту',
  victories: 'По победам',
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

  // 1) Тянем всех героев
  const heroRows = await db
    .select({
      id: heroes.id,
      nickname: heroes.nickname,
      heroClass: heroes.heroClass,
      level: heroes.level,
      xp: heroes.xp,
      gold: heroes.gold,
    })
    .from(heroes);

  // 2) Отдельно считаем победы по каждому герою
  const victoryRows = await db
    .select({
      heroId: submissions.heroId,
      count: sql<number>`count(*)::int`,
    })
    .from(submissions)
    .where(eq(submissions.status, 'victory'))
    .groupBy(submissions.heroId);

  const victoryMap = new Map<number, number>(
    victoryRows.map((r) => [r.heroId, Number(r.count)]),
  );

  // 3) Сливаем
  const enriched: Row[] = heroRows.map((h) => ({
    id: h.id,
    nickname: h.nickname,
    heroClass: h.heroClass,
    level: h.level,
    xp: h.xp,
    gold: h.gold,
    victories: victoryMap.get(h.id) ?? 0,
  }));

  // 4) Сортируем в JS — надёжнее, чем ORDER BY по подзапросу
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

  const rows = enriched.slice(0, 50);
  const myRank = me ? enriched.findIndex((r) => r.id === me.id) + 1 : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Лидерборд</h1>
        <p className="text-zinc-400 mb-6">
          Топ-50 героев. Обновляется в реальном времени.
        </p>

        {me && myRank > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-4 py-3 mb-6 text-sm flex items-center justify-between">
            <span className="text-amber-300">
              Твоя позиция: <span className="font-semibold">#{myRank}</span>
            </span>
            <Link
              href="/hero"
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              К профилю →
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={`/leaderboard?sort=${key}`}
              className={`px-4 py-2 rounded-md text-sm transition ${
                sort === key
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'border border-zinc-700 text-zinc-400 hover:border-amber-500/60 hover:text-amber-400'
              }`}
            >
              {SORT_LABELS[key]}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-500 text-sm">
            Пока никто не зарегистрировался. Будь первым!
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            {rows.map((r, i) => {
              const cls = HERO_CLASSES.find((c) => c.value === r.heroClass);
              const isMe = me?.id === r.id;
              const medal =
                i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-b-0 ${
                    isMe ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <div
                    className={`w-10 text-center text-sm font-mono ${
                      medal ? 'text-lg' : 'text-zinc-500'
                    }`}
                  >
                    {medal ?? `#${i + 1}`}
                  </div>

                  <div className="text-2xl">{cls?.icon ?? '🧙'}</div>

                                    <Link
                    href={`/u/${r.nickname}`}
                    className="flex-1 min-w-0 hover:opacity-90"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium truncate ${
                          isMe ? 'text-amber-400' : ''
                        }`}
                      >
                        {r.nickname}
                      </span>
                      {isMe && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          ты
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {cls?.label ?? r.heroClass}
                    </div>
                  </Link>

                  <div className="flex gap-4 text-sm shrink-0">
                    <div className="text-center min-w-[44px]">
                      <div className="text-xs text-zinc-500">ур.</div>
                      <div
                        className={`font-semibold ${
                          sort === 'level' ? 'text-amber-400' : ''
                        }`}
                      >
                        {r.level}
                      </div>
                    </div>
                    <div className="text-center min-w-[56px]">
                      <div className="text-xs text-zinc-500">XP</div>
                      <div
                        className={`font-semibold ${
                          sort === 'xp' ? 'text-amber-400' : ''
                        }`}
                      >
                        {r.xp}
                      </div>
                    </div>
                    <div className="text-center min-w-[52px]">
                      <div className="text-xs text-zinc-500">🪙</div>
                      <div
                        className={`font-semibold ${
                          sort === 'gold' ? 'text-amber-400' : ''
                        }`}
                      >
                        {r.gold}
                      </div>
                    </div>
                    <div className="text-center min-w-[52px]">
                      <div className="text-xs text-zinc-500">побед</div>
                      <div
                        className={`font-semibold ${
                          sort === 'victories' ? 'text-amber-400' : ''
                        }`}
                      >
                        {r.victories}
                      </div>
                    </div>
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