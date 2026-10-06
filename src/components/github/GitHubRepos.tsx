'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Repo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  private: boolean;
  fork: boolean;
  stargazers_count: number;
  default_branch: string;
  pushed_at: string;
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-500',
  Python: 'bg-emerald-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Java: 'bg-red-500',
  PHP: 'bg-violet-500',
  Ruby: 'bg-red-600',
  HTML: 'bg-orange-600',
  CSS: 'bg-blue-600',
};

export function GitHubRepos() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyOwn, setOnlyOwn] = useState(true);
  const [onlyPublic, setOnlyPublic] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/github/repos');
        const data = await res.json();
        if (!alive) return;
        if (!data.ok) {
          setError(data.error ?? 'Не удалось загрузить');
        } else {
          setRepos(data.repos as Repo[]);
        }
      } catch {
        if (alive) setError('Сеть недоступна');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = repos
    .filter((r) => (onlyOwn ? !r.fork : true))
    .filter((r) => (onlyPublic ? !r.private : true))
    .filter((r) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(s) ||
        (r.description ?? '').toLowerCase().includes(s)
      );
    });

  const privateCount = repos.filter((r) => r.private).length;

  if (loading) {
    return (
      <div className="mt-8 space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex gap-3 flex-wrap items-center mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 focus:border-amber-500/60 outline-none text-sm"
        />
        <button
          onClick={() => setOnlyOwn((v) => !v)}
          className={`px-4 py-2.5 rounded-xl text-sm border transition ${
            onlyOwn
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'border-white/10 text-zinc-400 hover:border-white/20'
          }`}
        >
          {onlyOwn ? '✓ ' : ''}Только свои
        </button>
        <button
          onClick={() => setOnlyPublic((v) => !v)}
          className={`px-4 py-2.5 rounded-xl text-sm border transition ${
            onlyPublic
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'border-white/10 text-zinc-400 hover:border-white/20'
          }`}
        >
          {onlyPublic ? '✓ ' : ''}Только публичные
        </button>
      </div>

      {privateCount > 0 && (
        <div className="mb-4 rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300/90 flex items-start gap-2">
          <span className="shrink-0">ℹ️</span>
          <span>
            У тебя {privateCount}{' '}
            {privateCount === 1
              ? 'приватный репозиторий'
              : 'приватных репозиториев'}
            . Пока платформа проверяет только публичные — сделай репо публичным
            или создай новый публичный для сдачи квеста.
          </span>
        </div>
      )}

      <div className="text-xs text-zinc-500 mb-3">
        {filtered.length} из {repos.length} репозиториев
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-zinc-500 text-sm">
          Ничего не найдено
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RepoCard key={r.id} repo={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RepoCard({ repo }: { repo: Repo }) {
  const langColor = repo.language
    ? LANGUAGE_COLORS[repo.language] ?? 'bg-zinc-500'
    : null;

  const updated = new Date(repo.pushed_at).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const repoUrl = repo.html_url;
  const canSubmit = !repo.private;

  return (
    <div className="glass rounded-2xl p-5 hover:bg-white/[0.03] transition group">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-zinc-100 hover:text-amber-400 transition truncate"
            >
              {repo.name}
            </a>
            {repo.private && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-violet-700/40 bg-violet-500/15 text-violet-300">
                🔒 private
              </span>
            )}
            {repo.fork && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700/40 bg-zinc-500/15 text-zinc-400">
                fork
              </span>
            )}
          </div>

          {repo.description && (
            <div className="text-sm text-zinc-400 mb-3 line-clamp-2">
              {repo.description}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-zinc-500">
            {repo.language && (
              <span className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${langColor}`} />
                {repo.language}
              </span>
            )}
            {repo.stargazers_count > 0 && (
              <span>★ {repo.stargazers_count}</span>
            )}
            <span>обновлён {updated}</span>
          </div>
        </div>

        {canSubmit ? (
          <Link
            href={`/verify?repo=${encodeURIComponent(repoUrl)}`}
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-medium hover:bg-amber-500/25 transition"
          >
            Сдать →
          </Link>
        ) : (
          <div
            className="shrink-0 px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-500 text-sm font-medium cursor-not-allowed flex items-center gap-2"
            title="Приватные репозитории пока не поддерживаются"
          >
            🔒 Недоступно
          </div>
        )}
      </div>
    </div>
  );
}