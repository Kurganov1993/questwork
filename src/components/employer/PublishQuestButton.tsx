'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function PublishQuestButton({ questId }: { questId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function publish() {
    setLoading(true);
    try {
      const res = await fetch(`/api/employer/quests/${questId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={publish}
      disabled={loading}
      className="px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition disabled:opacity-50"
    >
      {loading ? 'Публикуем…' : 'Опубликовать квест →'}
    </button>
  );
}