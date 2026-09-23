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
      signal: AbortSignal.timeout(15_000),
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

export const getRepo = (owner: string, repo: string) =>
  gh<GhRepo>(`/repos/${owner}/${repo}`);

export const getCommits = (owner: string, repo: string, perPage = 100) =>
  gh<GhCommit[]>(`/repos/${owner}/${repo}/commits?per_page=${perPage}`);

export const getRootContents = (owner: string, repo: string) =>
  gh<GhContentItem[]>(`/repos/${owner}/${repo}/contents/`);

export async function getReadme(owner: string, repo: string): Promise<string | null> {
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

export async function listTree(
  owner: string,
  repo: string,
  path = '',
  depth = 0,
  maxDepth = 3,
): Promise<GhContentItem[]> {
  if (depth > maxDepth) return [];
  let items: GhContentItem[] = [];
  try {
    items = await gh<GhContentItem[]>(`/repos/${owner}/${repo}/contents/${path}`);
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  const result: GhContentItem[] = [...items];
  const dirs = items.filter((i) => i.type === 'dir');
  for (const d of dirs) {
    if (
      ['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(d.name)
    )
      continue;
    const sub = await listTree(owner, repo, d.path, depth + 1, maxDepth);
    result.push(...sub);
  }
  return result;
}