import Link from 'next/link';
import { HERO_CLASSES } from '@/lib/constants';

type TopHero = {
  id: number;
  nickname: string;
  heroClass: string;
  level: number;
  xp: number;
  gold: number;
};

export function HeroPodium({ heroes }: { heroes: TopHero[] }) {
  if (heroes.length === 0) return null;

  const [first, second, third] = heroes;
  // Порядок отображения на подиуме: 2 — 1 — 3
  const podiumOrder = [second, first, third].filter(Boolean);

  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto">
        {podiumOrder.map((h, idx) => {
          const place = h === first ? 1 : h === second ? 2 : 3;
          const isFirst = place === 1;

          return (
            <div
              key={h.id}
              className={`flex flex-col items-center ${
                isFirst ? 'order-2' : place === 2 ? 'order-1' : 'order-3'
              }`}
            >
              {/* Медаль над героем */}
              <div
                className={`text-3xl sm:text-4xl mb-2 ${
                  isFirst ? 'animate-float' : ''
                }`}
              >
                {place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
              </div>

              <Link
                href={`/u/${h.nickname}`}
                className="group flex flex-col items-center"
              >
                <div
                  className={`relative rounded-full mb-2 ${
                    isFirst
                      ? 'ring-2 ring-amber-400/60 shadow-[0_0_30px_rgba(251,191,36,0.4)]'
                      : 'ring-1 ring-zinc-700'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center rounded-full bg-zinc-900 ${
                      isFirst
                        ? 'w-16 h-16 sm:w-20 sm:h-20 text-3xl sm:text-4xl'
                        : 'w-14 h-14 sm:w-16 sm:h-16 text-2xl sm:text-3xl'
                    }`}
                  >
                    {HERO_CLASSES.find((c) => c.value === h.heroClass)?.icon ??
                      '🧙'}
                  </div>
                </div>

                <div
                  className={`text-sm font-semibold truncate max-w-[100px] sm:max-w-[140px] group-hover:text-amber-400 transition ${
                    isFirst ? 'text-amber-300' : 'text-zinc-200'
                  }`}
                >
                  {h.nickname}
                </div>

                <div className="text-xs text-zinc-500 mt-0.5">
                  ур. {h.level} · {h.xp} XP
                </div>
              </Link>

              {/* Подиум */}
              <div
                className={`w-full mt-3 rounded-t-lg border-t border-x ${
                  isFirst
                    ? 'h-24 sm:h-32 bg-gradient-to-t from-amber-500/20 to-amber-500/5 border-amber-500/40'
                    : place === 2
                    ? 'h-16 sm:h-20 bg-gradient-to-t from-zinc-500/10 to-transparent border-zinc-700'
                    : 'h-12 sm:h-14 bg-gradient-to-t from-amber-800/10 to-transparent border-amber-900/40'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}