'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CHECK_TYPES } from '@/lib/check-types';

type PhaseForm = {
  name: string;
  description: string;
  checkType: string;
  maxHp: number;
};

const DEFAULT_PHASE: PhaseForm = {
  name: '',
  description: '',
  checkType: 'repo_exists',
  maxHp: 10,
};

export default function NewQuestPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('⚔️');
  const [bossName, setBossName] = useState('');
  const [difficulty, setDifficulty] = useState(1);
  const [rewardXp, setRewardXp] = useState(300);
  const [rewardGold, setRewardGold] = useState(20);
  const [victoryThreshold, setVictoryThreshold] = useState(65);
  const [phases, setPhases] = useState<PhaseForm[]>([
    { ...DEFAULT_PHASE, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
    { ...DEFAULT_PHASE, name: 'README и структура', description: 'Есть README и осмысленные коммиты.', checkType: 'readme', maxHp: 10 },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalHp = phases.reduce((s, p) => s + Number(p.maxHp || 0), 0);

  function updatePhase(i: number, patch: Partial<PhaseForm>) {
    setPhases((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  }

  function addPhase() {
    setPhases((prev) => [...prev, { ...DEFAULT_PHASE }]);
  }

  function removePhase(i: number) {
    setPhases((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/employer/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          icon,
          bossName,
          difficulty,
          rewardXp,
          rewardGold,
          victoryThreshold,
          phases,
        }),
      });
      if (res.status === 401) {
        window.location.href = '/employer/login';
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Не удалось создать квест');
      } else {
        router.push(`/employer/quests/${data.questId}`);
        router.refresh();
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
        <Link
          href="/employer"
          className="text-sm text-zinc-500 hover:text-amber-400"
        >
          ← В кабинет
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Новый квест</h1>
        <p className="text-zinc-400 mb-8">
          Опишите задачу. Платформа проверит сдачу по фазам, которые вы зададите.
        </p>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Основное */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Иконка</label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={4}
                  className="w-full px-3 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-center text-2xl"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Название квеста
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Собрать лендинг за 3 дня"
                  className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Описание</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Что нужно сделать, какой стек, критерии приёмки..."
                className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Имя босса
                </label>
                <input
                  type="text"
                  required
                  value={bossName}
                  onChange={(e) => setBossName(e.target.value)}
                  placeholder="Лендинг-Дракон"
                  className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Сложность (1–5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Награда XP
                </label>
                <input
                  type="number"
                  min={0}
                  value={rewardXp}
                  onChange={(e) => setRewardXp(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Награда золота
                </label>
                <input
                  type="number"
                  min={0}
                  value={rewardGold}
                  onChange={(e) => setRewardGold(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Порог победы, %
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={victoryThreshold}
                  onChange={(e) => setVictoryThreshold(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Фазы */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Фазы босса</div>
                <div className="text-xs text-zinc-500">
                  {phases.length} фаз · {totalHp} HP
                </div>
              </div>
              <button
                type="button"
                onClick={addPhase}
                disabled={phases.length >= 12}
                className="px-3 py-1.5 rounded-md border border-zinc-700 text-xs text-zinc-300 hover:border-amber-500/60 disabled:opacity-50"
              >
                + Добавить фазу
              </button>
            </div>

            <div className="space-y-3">
              {phases.map((p, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-zinc-400">
                      Фаза {i + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePhase(i)}
                      disabled={phases.length <= 1}
                      className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30"
                    >
                      Удалить
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_100px] gap-3 mb-3">
                    <input
                      type="text"
                      required
                      value={p.name}
                      onChange={(e) => updatePhase(i, { name: e.target.value })}
                      placeholder="Название фазы"
                      className="px-3 py-2 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                    />
                    <select
                      value={p.checkType}
                      onChange={(e) =>
                        updatePhase(i, { checkType: e.target.value })
                      }
                      className="px-3 py-2 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                    >
                      {CHECK_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={p.maxHp}
                      onChange={(e) =>
                        updatePhase(i, { maxHp: Number(e.target.value) })
                      }
                      placeholder="HP"
                      className="px-3 py-2 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-sm"
                    />
                  </div>

                  <input
                    type="text"
                    value={p.description}
                    onChange={(e) =>
                      updatePhase(i, { description: e.target.value })
                    }
                    placeholder="Что проверяем (необязательно)"
                    className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || phases.length === 0}
            className="w-full py-3 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-50"
          >
            {loading ? 'Публикуем…' : 'Опубликовать квест'}
          </button>
        </form>
      </div>
    </main>
  );
}