import type { LootItem } from '@/lib/types';

const RARITY_STYLE: Record<
  LootItem['rarity'],
  { border: string; bg: string; text: string; label: string }
> = {
  common: {
    border: 'border-zinc-700',
    bg: 'bg-zinc-900/40',
    text: 'text-zinc-300',
    label: 'Обычный',
  },
  rare: {
    border: 'border-blue-700/60',
    bg: 'bg-blue-950/20',
    text: 'text-blue-300',
    label: 'Редкий',
  },
  epic: {
    border: 'border-purple-700/60',
    bg: 'bg-purple-950/20',
    text: 'text-purple-300',
    label: 'Эпический',
  },
  legendary: {
    border: 'border-amber-600/60',
    bg: 'bg-amber-950/20',
    text: 'text-amber-300',
    label: 'Легендарный',
  },
};

export function LootCard({
  item,
  compact = false,
}: {
  item: LootItem;
  compact?: boolean;
}) {
  const style = RARITY_STYLE[item.rarity];

  if (compact) {
    return (
      <div
        className={`rounded-lg border ${style.border} ${style.bg} p-3 flex items-center gap-3`}
        title={item.description}
      >
        <div className="text-2xl">{item.icon}</div>
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate ${style.text}`}>
            {item.name}
          </div>
          <div className="text-xs text-zinc-500">{style.label}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-4`}>
      <div className="flex items-start gap-4">
        <div className="text-4xl">{item.icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-semibold ${style.text}`}>{item.name}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${style.border} ${style.text}`}
            >
              {style.label}
            </span>
            {item.isNew && (
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                новое
              </span>
            )}
          </div>
          <div className="text-sm text-zinc-400">{item.description}</div>
        </div>
      </div>
    </div>
  );
}