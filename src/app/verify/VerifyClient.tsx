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
}: {
  questSlug: string;
  questTitle: string;
  bossName: string;
  bossMaxHp: number;
  phaseNames: string[];
}) {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [livePhases, setLivePhases] = useState<LivePhase[]>([]);
  const [liveDamage, setLiveDamage] = useState(0);
  const [liveMaxHp, setLiveMaxHp] = useState(bossMaxHp);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="text-5xl">👑</div>
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
            className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none font-mono text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-50"
          >
            {loading ? 'Бой идёт…' : 'Сдать репозиторий'}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Проверка идёт… {livePhases.length} / {totalPhases} фаз ·{' '}
              {passedCount} пройдено
            </span>
            <span className="font-mono">{elapsed}s</span>
          </div>

          <div className="space-y-2">
            {phaseNames.map((name, i) => {
              const done = i < livePhases.length;
              const active = i === livePhases.length;
              const phase = done ? livePhases[i] : null;

              return (
                <div
                  key={name}
                  className={`text-sm flex items-center gap-2 transition ${
                    done
                      ? phase?.passed
                        ? 'text-emerald-300'
                        : 'text-red-300'
                      : active
                      ? 'text-amber-300'
                      : 'text-zinc-700'
                  }`}
                >
                  <span>
                    {done ? (phase?.passed ? '⚔️' : '💀') : active ? '⏳' : '·'}
                  </span>
                  <span>{name}</span>
                  {done && phase && phase.damage > 0 && (
                    <span className="text-xs text-amber-400">
                      -{phase.damage} HP
                    </span>
                  )}
                  {active && (
                    <span className="text-xs text-zinc-500">выполняется…</span>
                  )}
                </div>
              );
            })}
          </div>

          {elapsed > 30 && (
            <div className="text-xs text-amber-400/80 bg-amber-950/20 border border-amber-800/40 rounded-md p-2">
              Долго? Docker собирает зависимости проекта — обычно 2–4 минуты.
            </div>
          )}
        </div>
      )}

      {loading && livePhases.length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-sm text-zinc-500 tracking-widest">
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

      {report && (
        <div className="space-y-4">
          <div
            className={`rounded-xl border p-5 ${
              report.victory
                ? 'border-emerald-700/60 bg-emerald-950/30'
                : 'border-red-800/60 bg-red-950/30'
            }`}
          >
            <div className="text-lg font-semibold mb-1">
              {report.victory ? '🏆 Победа!' : '⚰️ Поражение'}
            </div>
            <div className="text-sm text-zinc-300 mb-3">{report.summary}</div>

            {report.victory && (
              <div className="flex gap-4 text-sm pt-3 border-t border-emerald-800/40 flex-wrap">
                {report.xpGained !== undefined && (
                  <div className="text-amber-400">✨ +{report.xpGained} XP</div>
                )}
                {report.goldGained !== undefined && (
                  <div className="text-amber-400">🪙 +{report.goldGained}</div>
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

          {report.victory && report.loot && report.loot.length > 0 && (
            <div>
              <h2 className="text-sm text-zinc-500 tracking-widest mb-3">
                ЛУТ
              </h2>
              <div className="space-y-2">
                {report.loot.map((item: LootItem) => (
                  <LootCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {report.achievementsGained && report.achievementsGained.length > 0 && (
            <div>
              <h2 className="text-sm text-zinc-500 tracking-widest mb-3">
                ДОСТИЖЕНИЯ
              </h2>
              <div className="space-y-2">
                {report.achievementsGained.map((a: EarnedAchievementItem) => (
                  <AchievementCard key={a.id} item={a} />
                ))}
              </div>
            </div>
          )}

          <h2 className="text-sm text-zinc-500 tracking-widest mt-6">
            ЛОГ БОЯ
          </h2>
          <div className="space-y-3">
            {report.phases.map((p, i) => (
              <PhaseLog key={p.order} phase={p} index={i} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}