'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EMPLOYER_STATUSES, STATUS_STYLE } from '@/lib/employer-constants';

type Notification = {
  submissionId: number;
  questTitle: string;
  questSlug: string;
  employerStatus: string;
  employerNote: string | null;
  employerStatusAt: string;
  isNew: boolean;
};

export function InvitationRow({ notification }: { notification: Notification }) {
  const router = useRouter();
  const [seen, setSeen] = useState(!notification.isNew);
  const [loading, setLoading] = useState(false);

  const meta = EMPLOYER_STATUSES.find(
    (s) => s.value === notification.employerStatus,
  );
  const statusLabel = meta?.label ?? notification.employerStatus;
  const styleClass = STATUS_STYLE[notification.employerStatus] ?? '';

  async function markSeen() {
    if (seen) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/hero/notifications/${notification.submissionId}/seen`,
        { method: 'POST' },
      );
      if (res.ok) {
        setSeen(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 transition ${
        seen
          ? 'border-zinc-800 bg-zinc-900/30'
          : 'border-amber-700/40 bg-amber-950/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/quests/${notification.questSlug}`}
              className="font-medium hover:text-amber-400"
            >
              {notification.questTitle}
            </Link>
            {!seen && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                новое
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs px-2 py-0.5 rounded border ${styleClass}`}
            >
              {statusLabel}
            </span>
            <span className="text-xs text-zinc-500">
              {new Date(notification.employerStatusAt).toLocaleString('ru-RU')}
            </span>
          </div>
          {notification.employerNote && (
            <div className="mt-2 text-sm text-zinc-300 italic border-l-2 border-zinc-700 pl-3">
              «{notification.employerNote}»
            </div>
          )}
        </div>

        {!seen && (
          <button
            onClick={markSeen}
            disabled={loading}
            className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:border-emerald-500/60 hover:text-emerald-400 transition disabled:opacity-50"
          >
            {loading ? '…' : 'Просмотрено'}
          </button>
        )}
      </div>
    </div>
  );
}