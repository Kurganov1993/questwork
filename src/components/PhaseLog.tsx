'use client';

import type { PhaseResult } from '@/lib/types';

export function PhaseLog({ phase, index }: { phase: PhaseResult; index: number }) {
  return (
    <div
      className={`rounded-lg border p-4 transition ${
        phase.passed
          ? 'border-emerald-700/50 bg-emerald-950/20'
          : 'border-red-800/50 bg-red-950/20'
      }`}
      style={{ animation: `fadeIn 0.4s ease ${index * 0.15}s both` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className={`text-lg ${phase.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {phase.passed ? '⚔️' : '💀'}
          </span>
          <span className="font-medium">{phase.name}</span>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            phase.passed
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-red-500/20 text-red-300'
          }`}
        >
          {phase.passed ? `-${phase.damage} HP` : 'промах'}
        </span>
      </div>
      <div className="text-xs text-zinc-500 mb-2">{phase.description}</div>
      <ul className="text-xs space-y-1">
        {phase.logs.map((l, i) => (
          <li key={i} className="font-mono text-zinc-400">{l}</li>
        ))}
      </ul>
    </div>
  );
}