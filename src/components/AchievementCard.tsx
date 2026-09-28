import type { EarnedAchievementItem } from '@/lib/types';

export function AchievementCard({
  item,
  compact = false,
}: {
  item: EarnedAchievementItem;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-3 flex items-center gap-3"
        title={item.description}
      >
        <div className="text-2xl">{item.icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate text-amber-300">
            {item.name}
          </div>
          <div className="text-xs text-zinc-500 truncate">
            {item.description}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-4">
      <div className="flex items-start gap-4">
        <div className="text-4xl">{item.icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-amber-300">{item.name}</span>
            {item.xpReward > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
                ✨ +{item.xpReward} XP
              </span>
            )}
            {item.goldReward > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
                🪙 +{item.goldReward}
              </span>
            )}
          </div>
          <div className="text-sm text-zinc-400">{item.description}</div>
        </div>
      </div>
    </div>
  );
}