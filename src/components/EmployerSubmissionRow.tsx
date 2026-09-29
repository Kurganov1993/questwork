'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EMPLOYER_STATUSES, STATUS_STYLE } from '@/lib/employer-constants';
import { HERO_CLASSES } from '@/lib/constants';

type Props = {
  submission: {
    id: number;
    repoUrl: string;
    status: string;
    damageDealt: number;
    createdAt: string;
    heroNickname: string;
    heroClass: string;
    heroLevel: number;
  };
  bossMaxHp: number;
  initialStatus: string | null;
  initialNote: string | null;
};

export function EmployerSubmissionRow({
  submission,
  bossMaxHp,
  initialStatus,
  initialNote,
}: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [note, setNote] = useState(initialNote ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const cls = HERO_CLASSES.find((c) => c.value === submission.heroClass);
  const victory = submission.status === 'victory';
  const pct = Math.round((submission.damageDealt / (bossMaxHp || 110)) * 100);

  async function save(newStatus: string | null, newNote?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/employer/submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employerStatus: newStatus,
          ...(newNote !== undefined ? { employerNote: newNote } : {}),
        }),
      });
      if (res.ok) {
        setStatus(newStatus);
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(null), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  function onStatusChange(v: string) {
    const newStatus = v === '' ? null : v;
    setStatus(newStatus);
    save(newStatus);
  }

  function onNoteBlur() {
    save(status, note);
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        victory
          ? 'border-emerald-800/40 bg-emerald-950/10'
          : 'border-red-900/40 bg-red-950/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Link
          href={`/u/${submission.heroNickname}`}
          className="flex items-center gap-3 hover:opacity-90"
        >
          <span className="text-2xl">{cls?.icon ?? '🧙'}</span>
          <div>
            <div className="font-medium">{submission.heroNickname}</div>
            <div className="text-xs text-zinc-500">
              {cls?.label ?? submission.heroClass} · ур. {submission.heroLevel}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {status && (
            <span
              className={`text-xs px-2 py-0.5 rounded border ${
                STATUS_STYLE[status] ?? ''
              }`}
            >
              {EMPLOYER_STATUSES.find((s) => s.value === status)?.label ?? status}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              victory
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-red-500/20 text-red-300'
            }`}
          >
            {victory ? 'победа' : 'поражение'} · {pct}%
          </span>
        </div>
      </div>

      <a
        href={submission.repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-zinc-500 font-mono truncate block mt-2 hover:text-amber-400"
      >
        {submission.repoUrl}
      </a>
      <div className="text-xs text-zinc-600 mt-1">
        {new Date(submission.createdAt).toLocaleString('ru-RU')}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center gap-2 flex-wrap">
        <select
          value={status ?? ''}
          onChange={(e) => onStatusChange(e.target.value)}
          disabled={saving}
          className="px-3 py-1.5 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-xs disabled:opacity-50"
        >
          <option value="">— Без статуса —</option>
          {EMPLOYER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={onNoteBlur}
          placeholder="Заметка (только для вас)"
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md bg-zinc-950 border border-zinc-700 focus:border-amber-500 outline-none text-xs"
        />

        {saving && <span className="text-xs text-zinc-500">Сохраняем…</span>}
        {!saving && savedAt && (
          <span className="text-xs text-emerald-400">✓ Сохранено</span>
        )}
      </div>
    </div>
  );
}