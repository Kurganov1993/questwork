export function HpBar({
  hp, maxHp, label, align = 'left',
}: { hp: number; maxHp: number; label: string; align?: 'left' | 'right' }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = pct > 60 ? 'bg-emerald-500' : pct > 30 ? 'bg-amber-500' : 'bg-red-600';

  return (
    <div className={`w-full ${align === 'right' ? 'text-right' : ''}`}>
      <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-between'} text-[11px] text-zinc-400 mb-1`}>
        <span className="font-medium">{label}</span>
        <span className={align === 'right' ? 'ml-2' : ''}>{hp} / {maxHp}</span>
      </div>
      <div className="h-2.5 rounded-sm bg-zinc-800 border border-zinc-700 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500 ${align === 'right' ? 'ml-auto' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}