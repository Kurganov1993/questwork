const GH_API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type RepoRef = { owner: string; repo: string };

export function parseRepoUrl(url: string): RepoRef | null {
  try {
    const u = new URL(url);
    if (!/^(www\.)?github\.com$/.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

async function gh<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'questwork-prototype',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`${GH_API}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GitHubError(res.status, `GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// --- Типы ответов (только нужные поля) ---

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

// --- Публичные методы ---

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

// Простой поиск файла в дереве (рекурсивно, до 3 уровней вглубь)
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
    items = await gh<GhContentItem[]>(
      `/repos/${owner}/${repo}/contents/${path}`,
    );
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  const result: GhContentItem[] = [...items];
  const dirs = items.filter((i) => i.type === 'dir');
  for (const d of dirs) {
    if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(d.name)) continue;
    const sub = await listTree(owner, repo, d.path, depth + 1, maxDepth);
    result.push(...sub);
  }
  return result;
}