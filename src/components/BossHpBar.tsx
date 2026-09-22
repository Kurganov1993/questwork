'use client';

export function BossHpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color =
    pct > 60 ? 'bg-emerald-500' : pct > 30 ? 'bg-amber-500' : 'bg-red-600';

  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>HP босса</span>
        <span>{hp} / {maxHp}</span>
      </div>
      <div className="h-4 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}