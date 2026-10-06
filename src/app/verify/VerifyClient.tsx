'use client';

import { useState, useEffect, useRef } from 'react';
import { BossHpBar } from '@/components/BossHpBar';
import { PhaseLog } from '@/components/PhaseLog';
import { LootCard } from '@/components/LootCard';
import { AchievementCard } from '@/components/AchievementCard';
import type {
  VerifyReport,
  PhaseResult,
  LootItem,
  EarnedAchievementItem,
} from '@/lib/types';

type LivePhase = {
  order: number;
  name: string;
  description: string;
  passed: boolean;
  damage: number;
  maxHp: number;
  logs: string[];
  details?: PhaseResult['details'];
};

export function VerifyClient({
  questSlug,
  bossName,
  bossMaxHp,
  phaseNames,
  initialRepo,
}: {
  questSlug: string;
  questTitle: string;
  bossName: string;
  bossMaxHp: number;
  phaseNames: string[];
  initialRepo?: string;
}) {
  const [repoUrl, setRepoUrl] = useState(initialRepo ?? '');
  const [loading, setLoading] = useState(false);
  const [livePhases, setLivePhases] = useState<LivePhase[]>([]);
  const [liveDamage, setLiveDamage] = useState(0);
  const [liveMaxHp, setLiveMaxHp] = useState(bossMaxHp);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Таймер во время проверки
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  // Прерывание запроса при размонтировании
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    setLivePhases([]);
    setLiveDamage(0);
    setLiveMaxHp(bossMaxHp);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, questSlug }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!res.body) {
        setError('Сервер не вернул поток данных');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }

          if (msg.type === 'start') {
            setLiveMaxHp(Number(msg.bossMaxHp ?? bossMaxHp));
          } else if (msg.type === 'phase') {
            const phase: LivePhase = {
              order: Number(msg.order),
              name: String(msg.name),
              description: String(msg.description ?? ''),
              passed: Boolean(msg.passed),
              damage: Number(msg.damage ?? 0),
              maxHp: Number(msg.maxHp ?? 0),
              logs: Array.isArray(msg.logs) ? (msg.logs as string[]) : [],
              details: msg.details as PhaseResult['details'],
            };

            setLivePhases((prev) => [...prev, phase]);
            setLiveDamage((prev) => prev + phase.damage);
          } else if (msg.type === 'done') {
            setReport(msg.report as VerifyReport);
          } else if (msg.type === 'error') {
            setError(String(msg.message ?? 'Ошибка проверки'));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError('Не удалось связаться с сервером');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  const currentHp = report
    ? Math.max(0, report.bossMaxHp - report.totalDamage)
    : Math.max(0, liveMaxHp - liveDamage);

  const currentMaxHp = report?.bossMaxHp ?? liveMaxHp;
  const passedCount = livePhases.filter((p) => p.passed).length;
  const totalPhases = phaseNames.length;

  return (
    <>
      {/* ==================== ФОРМА ==================== */}
      <div className="glass rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-amber-500/10 blur-[100px]" />

        <div className="relative">
          <div className="flex items-center gap-4 mb-5">
            <div className="text-4xl">👑</div>
            <div className="flex-1">
              <div className="font-semibold mb-1">{bossName}</div>
              <BossHpBar hp={currentHp} maxHp={currentMaxHp} />
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-sm text-zinc-400">
              Ссылка на GitHub-репозиторий
            </label>
            <input
              type="url"
              required
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/shop"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 focus:border-amber-500/60 outline-none font-mono text-sm transition"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.5)] disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? 'Бой идёт…' : '⚔️ Сдать репозиторий'}
            </button>
          </form>

          {error && (
            <div className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-xl p-3">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ==================== ПРОГРЕСС ==================== */}
      {loading && (
        <div className="mt-6 glass rounded-2xl p-6">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-4">
            <span className="font-mono">
              ПРОВЕРКА · {livePhases.length} / {totalPhases} ФАЗ ·{' '}
              {passedCount} ПРОЙДЕНО
            </span>
            <span className="font-mono text-amber-400">{elapsed}s</span>
          </div>

          {/* Прогресс-бар всех фаз */}
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-amber-500/60 to-amber-400 rounded-full transition-all duration-500"
              style={{
                width: `${(livePhases.length / totalPhases) * 100}%`,
              }}
            />
          </div>

          <div className="space-y-2">
            {phaseNames.map((name, i) => {
              const done = i < livePhases.length;
              const active = i === livePhases.length;
              const phase = done ? livePhases[i] : null;

              return (
                <div
                  key={name}
                  className={`text-sm flex items-center gap-3 transition ${
                    done
                      ? phase?.passed
                        ? 'text-emerald-300'
                        : 'text-red-300'
                      : active
                      ? 'text-amber-300'
                      : 'text-zinc-700'
                  }`}
                >
                  <span className="w-5 text-center">
                    {done
                      ? phase?.passed
                        ? '⚔️'
                        : '💀'
                      : active
                      ? '⏳'
                      : '·'}
                  </span>
                  <span className="flex-1 truncate">{name}</span>
                  {done && phase && phase.damage > 0 && (
                    <span className="text-xs text-amber-400 font-mono shrink-0">
                      -{phase.damage} HP
                    </span>
                  )}
                  {active && (
                    <span className="text-xs text-zinc-500 shrink-0">
                      выполняется…
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {elapsed > 30 && (
            <div className="mt-4 text-xs text-amber-400/80 bg-amber-950/20 border border-amber-800/40 rounded-xl p-3">
              ⏱️ Долго? Docker собирает зависимости проекта — обычно 2–4
              минуты на первый прогон.
            </div>
          )}
        </div>
      )}

      {/* ==================== ТЕКУЩИЙ ПРОГРЕСС ==================== */}
      {loading && livePhases.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3">
            <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
            ТЕКУЩИЙ ПРОГРЕСС
          </h2>
          {livePhases.slice(-3).map((p, i) => (
            <PhaseLog
              key={`live-${p.order}-${i}`}
              phase={{
                order: p.order,
                name: p.name,
                description: p.description,
                maxHp: p.maxHp,
                damage: p.damage,
                passed: p.passed,
                logs: p.logs,
                details: p.details,
              }}
              index={i}
            />
          ))}
        </div>
      )}

      {/* ==================== ИТОГОВЫЙ ОТЧЁТ ==================== */}
      {report && (
        <div className="mt-6 space-y-4">
          <div
            className={`rounded-2xl border p-6 relative overflow-hidden ${
              report.victory
                ? 'border-emerald-700/60 bg-emerald-950/20'
                : 'border-red-800/60 bg-red-950/20'
            }`}
          >
            <div
              className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[80px] ${
                report.victory ? 'bg-emerald-500/15' : 'bg-red-500/15'
              }`}
            />

            <div className="relative">
              <div className="text-2xl font-bold mb-2">
                {report.victory ? '🏆 Победа!' : '⚰️ Поражение'}
              </div>
              <div className="text-sm text-zinc-300 mb-4">
                {report.summary}
              </div>

              {report.victory && (
                <div className="flex gap-4 text-sm pt-4 border-t border-emerald-800/40 flex-wrap">
                  {report.xpGained !== undefined && (
                    <div className="text-amber-400">
                      ✨ +{report.xpGained} XP
                    </div>
                  )}
                  {report.goldGained !== undefined && (
                    <div className="text-amber-400">
                      🪙 +{report.goldGained}
                    </div>
                  )}
                  {report.achievementXp ? (
                    <div className="text-amber-300">
                      🏆 +{report.achievementXp} XP за достижения
                    </div>
                  ) : null}
                  {report.achievementGold ? (
                    <div className="text-amber-300">
                      🏆 +{report.achievementGold} золота за достижения
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Лут */}
          {report.victory && report.loot && report.loot.length > 0 && (
            <div>
              <SectionLabel>ЛУТ</SectionLabel>
              <div className="space-y-2" data-cascade>
                {report.loot.map((item: LootItem) => (
                  <div key={item.id} data-cascade-item>
                    <LootCard item={item} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Достижения */}
          {report.achievementsGained &&
            report.achievementsGained.length > 0 && (
              <div>
                <SectionLabel>ДОСТИЖЕНИЯ</SectionLabel>
                <div className="space-y-2" data-cascade>
                  {report.achievementsGained.map(
                    (a: EarnedAchievementItem) => (
                      <div key={a.id} data-cascade-item>
                        <AchievementCard item={a} />
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {/* Лог боя */}
          <div>
            <SectionLabel>ЛОГ БОЯ</SectionLabel>
            <div className="space-y-3">
              {report.phases.map((p, i) => (
                <PhaseLog key={p.order} phase={p} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==================== ХЕЛПЕРЫ ====================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3 mb-4">
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
      {children}
    </h2>
  );
}