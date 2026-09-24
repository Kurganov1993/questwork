'use client';

import { useState } from 'react';
import type { PhaseResult } from '@/lib/types';

// Метрики, которые нужны только бэкенду для расчёта урона,
// но не несут смысла для игрока
const HIDDEN_METRIC_KEYS = new Set([
  'deployDeclaredHp',
  'deployReachable',
]);

export function PhaseLog({ phase, index }: { phase: PhaseResult; index: number }) {
  const [showIssues, setShowIssues] = useState(false);
  const [showSemgrep, setShowSemgrep] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  const hasIssues = !!phase.details?.staticIssues?.length;
  const hasSemgrep = !!phase.details?.semgrepFindings?.length;

  // Отфильтрованные метрики: убираем служебные ключи
  const visibleMetrics = phase.details?.metrics
    ? Object.fromEntries(
        Object.entries(phase.details.metrics).filter(
          ([k]) => !HIDDEN_METRIC_KEYS.has(k),
        ),
      )
    : null;

  const hasMetrics = !!visibleMetrics && Object.keys(visibleMetrics).length > 0;

  return (
    <div
      className={`rounded-lg border p-4 transition ${
        phase.passed
          ? 'border-emerald-700/50 bg-emerald-950/20'
          : 'border-red-800/50 bg-red-950/20'
      }`}
      style={{ animation: `fadeIn 0.4s ease ${index * 0.15}s both` }}
    >
      {/* Заголовок фазы */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span
            className={`text-lg ${
              phase.passed ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
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
          {phase.damage > 0 ? `-${phase.damage} HP` : 'промах'}
        </span>
      </div>

      <div className="text-xs text-zinc-500 mb-2">{phase.description}</div>

      {/* Логи */}
      <ul className="text-xs space-y-1">
        {phase.logs.map((l, i) => (
          <li key={i} className="font-mono text-zinc-400 whitespace-pre-wrap">
            {l}
          </li>
        ))}
      </ul>

      {/* Метрики (без служебных ключей) */}
      {hasMetrics && (
        <div className="mt-3">
          <button
            onClick={() => setShowMetrics((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showMetrics ? '▾' : '▸'} Метрики анализа
          </button>
          {showMetrics && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(visibleMetrics!).map(([k, v]) => (
                <div
                  key={k}
                  className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1"
                >
                  <div className="text-zinc-500">{k}</div>
                  <div className="text-zinc-200 font-mono">{String(v)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ESLint / статические проблемы */}
      {hasIssues && (
        <div className="mt-3">
          <button
            onClick={() => setShowIssues((v) => !v)}
            className="text-xs text-amber-400/80 hover:text-amber-300"
          >
            {showIssues ? '▾' : '▸'} Проблемы ESLint (
            {phase.details!.staticIssues!.length})
          </button>
          {showIssues && (
            <ul className="mt-2 space-y-1 text-xs font-mono max-h-64 overflow-y-auto pr-2">
              {phase.details!.staticIssues!.slice(0, 30).map((i, idx) => (
                <li
                  key={idx}
                  className={
                    i.severity === 'error'
                      ? 'text-red-400'
                      : i.severity === 'warning'
                      ? 'text-amber-400'
                      : 'text-zinc-500'
                  }
                >
                  {i.file}:{i.line ?? '?'} · {i.rule} · {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Semgrep */}
      {hasSemgrep && (
        <div className="mt-3">
          <button
            onClick={() => setShowSemgrep((v) => !v)}
            className="text-xs text-red-400/80 hover:text-red-300"
          >
            {showSemgrep ? '▾' : '▸'} Находки Semgrep (
            {phase.details!.semgrepFindings!.length})
          </button>
          {showSemgrep && (
            <ul className="mt-2 space-y-1 text-xs font-mono max-h-64 overflow-y-auto pr-2">
              {phase.details!.semgrepFindings!.slice(0, 30).map((f, idx) => (
                <li
                  key={idx}
                  className={
                    /ERROR|HIGH/i.test(f.severity)
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }
                >
                  {f.file}:{f.line} · {f.rule} · {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}