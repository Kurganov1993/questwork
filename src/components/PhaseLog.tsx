'use client';

import { useState } from 'react';
import type { PhaseResult } from '@/lib/types';

export function PhaseLog({ phase, index }: { phase: PhaseResult; index: number }) {
  const [showIssues, setShowIssues] = useState(false);
  const [showSemgrep, setShowSemgrep] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showContainer, setShowContainer] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const hasIssues = !!phase.details?.staticIssues?.length;
  const hasSemgrep = !!phase.details?.semgrepFindings?.length;
  const hasMetrics = !!phase.details?.metrics;
  const hasContainer =
    !!phase.details?.containerLogs && phase.details.containerLogs.length > 0;
  const hasAI = !!phase.details?.aiReview;

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
          <span
            className={`text-lg ${
              phase.passed ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {phase.passed ? '⚔️' : '💀'}
          </span>
          <span className="font-medium">{phase.name}</span>
          {hasContainer && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-700/40">
              Docker
            </span>
          )}
          {hasAI && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-700/40">
              AI
            </span>
          )}
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
          <li key={i} className="font-mono text-zinc-400 whitespace-pre-wrap">
            {l}
          </li>
        ))}
      </ul>

      {/* Метрики */}
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
              {Object.entries(phase.details!.metrics!).map(([k, v]) => (
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

      {/* Логи контейнера (Docker) */}
      {hasContainer && (
        <div className="mt-3">
          <button
            onClick={() => setShowContainer((v) => !v)}
            className="text-xs text-blue-400/80 hover:text-blue-300"
          >
            {showContainer ? '▾' : '▸'} Логи контейнера (
            {phase.details!.containerLogs!.length})
            {phase.details?.containerReason && (
              <span className="text-zinc-600 ml-1">
                · {phase.details.containerReason}
              </span>
            )}
          </button>
          {showContainer && (
            <pre className="mt-2 max-h-80 overflow-y-auto text-xs font-mono text-zinc-400 bg-black/40 rounded border border-zinc-800 p-3 whitespace-pre-wrap">
              {phase.details!.containerLogs!.join('\n')}
            </pre>
          )}
        </div>
      )}

      {/* AI-ревью */}
      {hasAI && (
        <div className="mt-3">
          <button
            onClick={() => setShowAI((v) => !v)}
            className="text-xs text-purple-400/80 hover:text-purple-300"
          >
            {showAI ? '▾' : '▸'} Разбор от AI (
            {phase.details!.aiReview!.issues.length} замечаний, оценка{' '}
            {phase.details!.aiReview!.score}/100)
          </button>

          {showAI && (
            <div className="mt-3 space-y-4">
              {/* Провайдер и summary */}
              {phase.details!.aiReview!.summary && (
                <div className="text-sm text-zinc-300 bg-purple-950/20 border border-purple-800/40 rounded-md p-3">
                  <div className="text-xs text-purple-400 mb-1 font-mono">
                    {phase.details!.aiReview!.provider} ·{' '}
                    {phase.details!.aiReview!.model} ·{' '}
                    {(phase.details!.aiReview!.durationMs / 1000).toFixed(1)}с
                  </div>
                  {phase.details!.aiReview!.summary}
                </div>
              )}

              {/* Сильные стороны */}
              {phase.details!.aiReview!.strengths.length > 0 && (
                <div>
                  <div className="text-xs text-emerald-400 mb-2 font-medium">
                    ✓ Сильные стороны
                  </div>
                  <ul className="text-xs text-zinc-400 space-y-1 ml-1">
                    {phase.details!.aiReview!.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-500 shrink-0">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Замечания */}
              {phase.details!.aiReview!.issues.length > 0 && (
                <div>
                  <div className="text-xs text-amber-400 mb-2 font-medium">
                    ⚠ Замечания ({phase.details!.aiReview!.issues.length})
                  </div>
                  <div className="space-y-2">
                    {phase.details!.aiReview!.issues.map((issue, i) => {
                      const sevColor =
                        issue.severity === 'error'
                          ? 'border-red-800/50 bg-red-950/20'
                          : issue.severity === 'warning'
                          ? 'border-amber-800/50 bg-amber-950/20'
                          : 'border-zinc-800 bg-zinc-900/30';

                      const sevBadge =
                        issue.severity === 'error'
                          ? 'bg-red-500/20 text-red-300'
                          : issue.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-zinc-500/20 text-zinc-300';

                      return (
                        <div
                          key={i}
                          className={`rounded-md border ${sevColor} p-3`}
                        >
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${sevBadge}`}
                            >
                              {issue.severity}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {issue.category}
                            </span>
                            <span className="text-xs font-mono text-zinc-400">
                              {issue.file}
                              {issue.line ? `:${issue.line}` : ''}
                            </span>
                          </div>
                          <div className="text-sm text-zinc-200 mb-2">
                            {issue.message}
                          </div>
                          {issue.suggestion && (
                            <div className="text-xs text-zinc-400 border-l-2 border-zinc-700 pl-3">
                              <span className="text-emerald-400">
                                → Как исправить:{' '}
                              </span>
                              {issue.suggestion}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}