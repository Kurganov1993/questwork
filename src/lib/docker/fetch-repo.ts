import { mkdtemp, rm, mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import * as tar from 'tar';

export type RepoDir = {
  path: string;
  cleanup: () => Promise<void>;
};

export async function fetchRepoToTemp(
  owner: string,
  repo: string,
  branch: string,
): Promise<RepoDir> {
  const root = await mkdtemp(join(tmpdir(), 'qw-build-'));
  const tarPath = join(root, 'repo.tar.gz');
  const srcDir = join(root, 'src');

  const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${encodeURIComponent(
    branch,
  )}`;

  try {
    await downloadWithRetry(url, tarPath, 3);

    await mkdir(srcDir, { recursive: true });

    await tar.x({
      file: tarPath,
      cwd: srcDir,
      strip: 1,
    });

    await stat(srcDir);

    return {
      path: srcDir,
      cleanup: async () => {
        await rm(root, { recursive: true, force: true }).catch(() => {});
      },
    };
  } catch (e) {
    await rm(root, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

async function downloadWithRetry(
  url: string,
  dest: string,
  attempts: number,
): Promise<void> {
  let lastError: unknown;

  for (let i = 1; i <= attempts; i++) {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'questwork-prototype',
      };
      const token = process.env.GITHUB_TOKEN?.trim();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        redirect: 'follow',
        headers,
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok || !res.body) {
        throw new Error(`GitHub отдал HTTP ${res.status}`);
      }

      const nodeStream = Readable.fromWeb(res.body as never);
      await pipeline(nodeStream, createWriteStream(dest));
      return;
    } catch (e) {
      lastError = e;
      console.warn(
        `[fetch-repo] попытка ${i}/${attempts} не удалась: ${(e as Error).message}`,
      );
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 1000 * i));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Не удалось скачать архив');
}