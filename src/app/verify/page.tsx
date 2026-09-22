'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { BattleScene } from '@/components/BattleScene';
import { PhaseLog } from '@/components/PhaseLog';
import type { PhaseResult, VerifyReport } from '@/lib/types';

type AnimState = 'idle' | 'attack' | 'hit' | 'victory' | 'defeated';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VerifyPage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<VerifyReport | null>(null);
  const [revealed, setRevealed] = useState<PhaseResult[]>([]);

  const [heroAnim, setHeroAnim] = useState<AnimState>('idle');
  const [bossAnim, setBossAnim] = useState<AnimState>('idle');
  const [bossHp, setBossHp] = useState(100);
  const [bossMaxHp, setBossMaxHp] = useState(100);
  const [damagePopup, setDamagePopup] = useState<{ value: number; key: number } | null>(null);

  const battleIdRef = useRef(0);

  async function playBattle(rep: VerifyReport) {
    const myId = ++battleIdRef.current;
    setRevealed([]);
    setBossMaxHp(rep.bossMaxHp);
    setBossHp(rep.bossMaxHp);

    await sleep(400);
    if (battleIdRef.current !== myId) return;

    for (const phase of rep.phases) {
      // 1) Герой атакует
      setHeroAnim('attack');
      await sleep(300);
      if (battleIdRef.current !== myId) return;

      // 2) Босс получает удар / промах
      if (phase.passed) {
        setBossAnim('hit');
        setDamagePopup({ value: phase.damage, key: Date.now() });
        setBossHp((h) => Math.max(0, h - phase.damage));
      } else {
        setBossAnim('idle');
      }

      setRevealed((prev) => [...prev, phase]);

      await sleep(600);
      if (battleIdRef.current !== myId) return;

      setHeroAnim('idle');
      setBossAnim('idle');
      setDamagePopup(null);
    }

    // 3) Финал
    if (rep.victory) {
      setHeroAnim('victory');
      setBossAnim('defeated');
      setBossHp(0);
    } else {
      setHeroAnim('idle');
      setBossAnim('idle');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    setRevealed([]);
    setLoading(true);
    setHeroAnim('idle');
    setBossAnim('idle');
    setBossHp(100);
    setDamagePopup(null);

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
        setReport(data.report);
        void playBattle(data.report);
      }
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  }

  const heroHp = 100;
  const heroMaxHp = 100;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Проверка кода</h1>
        <p className="text-zinc-400 mb-6">
          Квест «Создать интернет-магазин» · Босс:{' '}
          <span className="text-amber-400">Древний Торговец</span>
        </p>

        <div className="mb-6">
          <BattleScene
            heroClass="frontend_mage"
            heroName="Гость"
            heroHp={heroHp}
            heroMaxHp={heroMaxHp}
            heroAnim={heroAnim}
            bossName="Древний Торговец"
            bossHp={bossHp}
            bossMaxHp={bossMaxHp}
            bossAnim={bossAnim}
            damagePopup={damagePopup}
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-3 mb-6">
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
          <div className="mb-4 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
            {error}
          </div>
        )}

        {report && revealed.length > 0 && (
          <div className="space-y-4">
            <div
              className={`rounded-xl border p-5 ${
                report.victory && revealed.length === report.phases.length
                  ? 'border-emerald-700/60 bg-emerald-950/30'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="text-lg font-semibold mb-1">
                {revealed.length < report.phases.length
                  ? '⚔️ Бой идёт…'
                  : report.victory
                  ? '🏆 Победа!'
                  : '⚰️ Поражение'}
              </div>
              <div className="text-sm text-zinc-300">
                {revealed.length < report.phases.length
                  ? `Раскрыто фаз: ${revealed.length} / ${report.phases.length}`
                  : report.summary}
              </div>
            </div>

            <h2 className="text-sm text-zinc-500 tracking-widest mt-6">ЛОГ БОЯ</h2>
            <div className="space-y-3">
              {revealed.map((p, i) => (
                <PhaseLog key={p.order} phase={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}