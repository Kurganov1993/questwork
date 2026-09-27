const GH_API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
    public rateLimit?: { remaining: number; reset: number },
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

type RepoRef = { owner: string; repo: string };

export function parseRepoUrl(url: string): RepoRef | null {
  try {
    const u = new URL(url.trim());
    if (!/^(www\.)?github\.com$/.test(u.hostname)) return null;
    const parts = u.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.git$/, '')
      .split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

async function gh<T>(path: string, attempt = 1): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'questwork-prototype',
  };

  const token = process.env.GITHUB_TOKEN?.trim();
  if (token && token.length > 0) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${GH_API}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const cause = err.cause as
      | (Error & { code?: string; errno?: number; syscall?: string })
      | undefined;

    const details = cause
      ? `${cause.name ?? 'Error'}: ${cause.message ?? ''}${
          cause.code ? ` [${cause.code}]` : ''
        }${cause.syscall ? ` syscall=${cause.syscall}` : ''}`
      : err.message;

    if (attempt === 1) {
      await new Promise((r) => setTimeout(r, 400));
      return gh<T>(path, 2);
    }

    throw new GitHubError(
      0,
      `Сетевая ошибка при запросе к GitHub (${GH_API}${path}): ${details}`,
    );
  }

  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  const rateLimit =
    remaining !== null
      ? { remaining: Number(remaining), reset: Number(reset ?? 0) }
      : undefined;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let reason = `GitHub ${res.status}`;

    if (res.status === 401) {
      reason = 'GitHub 401: токен невалиден. Проверь GITHUB_TOKEN или удали его.';
    } else if (res.status === 403) {
      if (rateLimit && rateLimit.remaining === 0) {
        const resetAt = new Date(rateLimit.reset * 1000).toLocaleTimeString('ru-RU');
        reason = `GitHub 403: лимит исчерпан. Сброс в ${resetAt}. Добавь/проверь GITHUB_TOKEN.`;
      } else {
        reason = `GitHub 403: доступ запрещён. ${body.slice(0, 150)}`;
      }
    } else if (res.status === 404) {
      reason = 'GitHub 404: репозиторий не найден или приватный.';
    } else {
      reason = `GitHub ${res.status}: ${body.slice(0, 200)}`;
    }

    throw new GitHubError(res.status, reason, rateLimit);
  }

  return res.json() as Promise<T>;
}

// ---------- Типы ----------

export type GhRepo = {
  full_name: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  size: number;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  created_at: string;
  pushed_at: string;
  license: { spdx_id: string } | null;
  topics?: string[];
};

export type GhCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
};

export type GhContentItem = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
};

type GhTreeResponse = {
  tree: Array<{
    path: string;
    mode: string;
    type: 'blob' | 'tree' | 'commit';
    sha: string;
    size?: number;
  }>;
  truncated: boolean;
};

// ---------- Публичные методы ----------

export const getRepo = (owner: string, repo: string) =>
  gh<GhRepo>(`/repos/${owner}/${repo}`);

export const getCommits = (owner: string, repo: string, perPage = 100) =>
  gh<GhCommit[]>(`/repos/${owner}/${repo}/commits?per_page=${perPage}`);

export const getRootContents = (owner: string, repo: string) =>
  gh<GhContentItem[]>(`/repos/${owner}/${repo}/contents/`);

/**
 * Полное дерево репозитория ОДНИМ запросом через Git Trees API.
 * Быстрее, чем рекурсивный обход Contents API в десятки раз.
 */
export async function listTree(
  owner: string,
  repo: string,
): Promise<GhContentItem[]> {
  let repoMeta: GhRepo;
  try {
    repoMeta = await getRepo(owner, repo);
  } catch {
    return [];
  }

  const branch = repoMeta.default_branch || 'main';

  let data: GhTreeResponse;
  try {
    data = await gh<GhTreeResponse>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );
  } catch (e) {
    console.error('[listTree] trees API failed:', (e as Error).message);
    return [];
  }

  if (!data.tree || !Array.isArray(data.tree)) return [];

  const SKIP_DIRS = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.vercel',
  ];

  return data.tree
    .filter((t) => t.type === 'blob')
    .filter(
      (t) =>
        !SKIP_DIRS.some(
          (d) => t.path.includes(`/${d}/`) || t.path.startsWith(`${d}/`),
        ),
    )
    .map((t) => ({
      name: t.path.split('/').pop() ?? t.path,
      path: t.path,
      type: 'file' as const,
      size: t.size ?? 0,
    }));
}

export async function getReadme(
  owner: string,
  repo: string,
): Promise<string | null> {
  try {
    const data = await gh<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/readme`,
    );
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return data.content;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export async function getFileText(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const data = await gh<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path}`,
    );
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return data.content;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Пакетная загрузка файлов с ограничением параллелизма.
 * Возвращает карту path → content. Ошибки отдельных файлов игнорируются.
 */
export async function getFilesBatch(
  owner: string,
  repo: string,
  paths: string[],
  concurrency = 8,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const queue = [...paths];

  async function worker() {
    while (queue.length > 0) {
      const path = queue.shift();
      if (!path) return;
      try {
        const text = await getFileText(owner, repo, path);
        if (text !== null) result.set(path, text);
      } catch {
        // молча пропускаем — один плохой файл не должен ломать фазу
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, paths.length) }, worker),
  );

  return result;
}