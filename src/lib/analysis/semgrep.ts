import type { SemgrepFinding } from '../types';

export type { SemgrepFinding };

/**
 * Заглушка. Semgrep — это Python-инструмент, он не ставится через npx.
 * На Windows установка требует pip/pipx. Включим позже — в Docker-раннере.
 *
 * Чтобы включить обратно:
 *   1. Установи Semgrep:  pip install semgrep
 *   2. Раскомментируй реализацию ниже.
 */
export async function runSemgrep(
  _files: { path: string; content: string }[],
): Promise<SemgrepFinding[]> {
  return [];
}

/*
// --- Реальная реализация (раскомментировать после установки Semgrep) ---

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const exec = promisify(execFile);

export async function runSemgrep(
  files: { path: string; content: string }[],
): Promise<SemgrepFinding[]> {
  if (files.length === 0) return [];

  const dir = await mkdtemp(join(tmpdir(), 'questwork-semgrep-'));

  try {
    for (const f of files) {
      const full = join(dir, f.path);
      await mkdir(dirname(full), { recursive: true }).catch(() => {});
      await writeFile(full, f.content, { encoding: 'utf-8' }).catch(() => {});
    }

    const { stdout } = await exec(
      'semgrep',
      [
        '--config', 'p/security-audit',
        '--config', 'p/owasp-top-ten',
        '--json',
        '--quiet',
        '--no-git-ignore',
        dir,
      ],
      {
        timeout: 90_000,
        maxBuffer: 20 * 1024 * 1024,
        env: { ...process.env, SEMGREP_SEND_METRICS: 'off' },
      },
    );

    return parseSemgrepOutput(stdout, dir);
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    if (err.stdout) {
      try {
        const parsed = parseSemgrepOutput(err.stdout, dir);
        if (parsed.length > 0) return parsed;
      } catch { }
    }
    console.warn('[semgrep] failed:', err.message ?? err.stderr ?? 'unknown');
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function parseSemgrepOutput(stdout: string, baseDir: string): SemgrepFinding[] {
  let parsed: { results?: unknown[] };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  const results = Array.isArray(parsed.results) ? parsed.results : [];
  return results.map((r) => {
    const item = r as {
      path?: string;
      start?: { line?: number };
      check_id?: string;
      extra?: { severity?: string; message?: string };
    };
    const path = (item.path ?? '').replace(baseDir + '/', '').replace(/^\/+/, '');
    return {
      file: path || 'unknown',
      line: item.start?.line ?? 0,
      rule: item.check_id ?? 'unknown',
      severity: item.extra?.severity ?? 'WARNING',
      message: item.extra?.message ?? '',
    };
  });
}
*/