import Link from 'next/link';
import { HERO_CLASSES } from '@/lib/constants';

export type TickerVictory = {
  id: number;
  heroNickname: string;
  heroClass: string;
  questTitle: string;
  questIcon: string;
  questSlug: string;
  bossName: string;
  damageDealt: number;
  bossMaxHp: number;
};

export function VictoryTicker({ victories }: { victories: TickerVictory[] }) {
  if (victories.length === 0) return null;

  // Дублируем список, чтобы прокрутка была бесшовной
  const items = [...victories, ...victories];

  return (
    <div className="relative overflow-hidden py-4 border-y border-zinc-800/60 bg-zinc-950/60">
      {/* Маска по краям */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />

      <div className="flex gap-8 animate-ticker whitespace-nowrap">
        {items.map((v, idx) => {
          const cls = HERO_CLASSES.find((c) => c.value === v.heroClass);
          const pct = Math.round((v.damageDealt / (v.bossMaxHp || 110)) * 100);
          return (
            <div
              key={`${v.id}-${idx}`}
              className="flex items-center gap-2 text-sm text-zinc-400 shrink-0"
            >
              <span className="text-base">⚔️</span>
              <Link
                href={`/u/${v.heroNickname}`}
                className="font-medium text-zinc-200 hover:text-amber-400 transition"
              >
                {cls?.icon} {v.heroNickname}
              </Link>
              <span className="text-zinc-600">победил</span>
              <span className="text-amber-400">👑 {v.bossName}</span>
              <span className="text-zinc-600">·</span>
              <Link
                href={`/quests/${v.questSlug}`}
                className="hover:text-amber-400 transition"
              >
                {v.questIcon} {v.questTitle}
              </Link>
              <span className="text-emerald-400 text-xs font-mono">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}