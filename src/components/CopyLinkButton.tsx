'use client';

import { useState } from 'react';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-xs text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 transition"
    >
      <span>{copied ? '✓' : '🔗'}</span>
      <span>{copied ? 'Скопировано' : 'Поделиться'}</span>
    </button>
  );
}