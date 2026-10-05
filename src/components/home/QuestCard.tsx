import Link from 'next/link';

type Quest = {
  id: number;
  slug: string;
  title: string;
  description: string;
  icon: string;
  bossName: string;
  bossMaxHp: number;
  difficulty: number;
  rewardXp: number;
  rewardGold: number;
  victoryThreshold: number;
};

export function QuestCard({
  quest,
  cleared = false,
}: {
  quest: Quest;
  cleared?: boolean;
}) {
  const stars =
    '★'.repeat(quest.difficulty) +
    '☆'.repeat(Math.max(0, 5 - quest.difficulty));

  return (
    <Link
      href={`/quests/${quest.slug}`}
      className="block rounded-2xl glass card-glow p-6 relative overflow-hidden group"
    >
      {/* Декоративное свечение в углу */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl group-hover:bg-amber-500/20 transition-all duration-500" />

      <div className="relative flex items-start justify-between gap-6">
        <div className="flex items-start gap-5 flex-1 min-w-0">
          <div className="text-5xl leading-none shrink-0 drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
            {quest.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs tracking-widest text-amber-400 font-mono">
                {stars}
              </span>
              {cleared && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-700/40">
                  ✔ пройден
                </span>
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-amber-400 transition">
              {quest.title}
            </h3>
            <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
              {quest.description}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <Stat icon="👑" label={quest.bossName} />
              <Stat icon="❤️" label={`${quest.bossMaxHp} HP`} />
              <Stat icon="✨" label={`${quest.rewardXp} XP`} />
              <Stat icon="🪙" label={String(quest.rewardGold)} />
              <Stat icon="🎯" label={`порог ${quest.victoryThreshold}%`} />
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-mono">
          награда за победу
        </span>
        <span className="text-amber-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
          принять →
        </span>
      </div>
    </Link>
  );
}

function Stat({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-400">
      <span className="opacity-80">{icon}</span>
      <span>{label}</span>
    </span>
  );
}