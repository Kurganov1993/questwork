'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BossHpBar } from '@/components/BossHpBar';
import { PhaseLog } from '@/components/PhaseLog';
import type { VerifyReport } from '@/lib/types';

const PHASE_NAMES = [
  'Репозиторий открыт',
  'README и структура',
  'Сборка проекта',
  'Статический анализ',
  'Тесты проходят',
  'Деплой живой',
  'E2E-сценарий',
  'Безопасность',
  'Ревью наставника',
];

export default function VerifyPage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [visiblePhases, setVisiblePhases] = useState(0);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bossMaxHp = report?.bossMaxHp ?? 110;
  const currentHp = report ? Math.max(0, bossMaxHp - report.totalDamage) : bossMaxHp;

  useEffect(() => {
    if (loading) {
      setVisiblePhases(0);
      timerRef.current = setInterval(() => {
        setVisiblePhases((v) => (v < PHASE_NAMES.length ? v + 1 : v));
      }, 500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, questSlug: 'create-shop' }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Ошибка проверки');
      } else {
        setTimeout(() => setReport(data.report), 500);
      }
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Проверка кода</h1>
        <p className="text-zinc-400 mb-8">
          Квест «Создать интернет-магазин» · Босс:{' '}
          <span className="text-amber-400">Древний Торговец</span>
        </p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="text-5xl">👑</div>
            <div className="flex-1">
              <div className="font-semibold mb-1">Древний Торговец</div>
              <BossHpBar hp={currentHp} maxHp={bossMaxHp} />
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
          <div className="mb-6 space-y-2">
            {PHASE_NAMES.map((name, i) => (
              <div
                key={name}
                className={`text-sm flex items-center gap-2 transition ${
                  i < visiblePhases ? 'text-zinc-300' : 'text-zinc-700'
                }`}
              >
                <span>{i < visiblePhases ? '⚔️' : '·'}</span>
                <span>{name}</span>
              </div>
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
              <div className="text-sm text-zinc-300">{report.summary}</div>
            </div>

            <h2 className="text-sm text-zinc-500 tracking-widest mt-6">ЛОГ БОЯ</h2>
            <div className="space-y-3">
              {report.phases.map((p, i) => (
                <PhaseLog key={p.order} phase={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}