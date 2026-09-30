import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  runContainer,
  isDockerAvailable,
  pullImage,
  imageExists,
} from './client';
import { fetchRepoToTemp } from './fetch-repo';

const IMAGE = 'node:20-alpine';
const TOTAL_TIMEOUT = 480_000;

export type TestResult = {
  ok: boolean;
  logs: string[];
  reason?: string;
  durationMs: number;
  passed?: number;
  failed?: number;
  total?: number;
};

export async function runTestCheck(
  owner: string,
  repo: string,
  branch: string,
): Promise<TestResult> {
  const t0 = Date.now();
  const logs: string[] = [];

  if (!(await isDockerAvailable())) {
    return {
      ok: false,
      logs: ['✘ Docker недоступен — реальный прогон тестов пропущен'],
      reason: 'docker-unavailable',
      durationMs: Date.now() - t0,
    };
  }

  let repoDir: Awaited<ReturnType<typeof fetchRepoToTemp>> | null = null;

  try {
    repoDir = await fetchRepoToTemp(owner, repo, branch);
    logs.push('✔ Исходники скачаны');

    let pkg: Record<string, unknown> | null = null;
    try {
      const raw = await readFile(join(repoDir.path, 'package.json'), 'utf-8');
      pkg = JSON.parse(raw);
    } catch {
      logs.push('✘ package.json не найден');
      return {
        ok: false,
        logs,
        reason: 'no-package-json',
        durationMs: Date.now() - t0,
      };
    }

    const scripts = (pkg?.scripts as Record<string, string>) ?? {};
    const testScript = scripts.test;
    if (!testScript || testScript.includes('no test specified')) {
      logs.push('✘ Скрипт "test" не настроен');
      return {
        ok: false,
        logs,
        reason: 'no-test-script',
        durationMs: Date.now() - t0,
      };
    }
    logs.push(`✔ Скрипт test: ${testScript}`);

    if (!(await imageExists(IMAGE))) {
      logs.push(`↓ Скачиваем образ ${IMAGE}…`);
      const pulled = await pullImage(IMAGE);
      if (!pulled) {
        logs.push(`✘ Не удалось скачать образ ${IMAGE}`);
        return {
          ok: false,
          logs,
          reason: 'image-pull-failed',
          durationMs: Date.now() - t0,
        };
      }
    }

    const hasLock = await fileExists(join(repoDir.path, 'package-lock.json'));
    const pnpmLock = await fileExists(join(repoDir.path, 'pnpm-lock.yaml'));
    const yarnLock = await fileExists(join(repoDir.path, 'yarn.lock'));

    let installScript: string;
    if (pnpmLock) {
      installScript =
        'corepack enable && pnpm install --no-frozen-lockfile --prod=false';
    } else if (yarnLock) {
      installScript =
        'corepack enable && yarn install --no-immutable --production=false';
    } else {
      installScript = 'npm install --no-audit --no-fund --include=dev';
    }

    const command = [
      'set -u',
      'echo "=== STEP: install ==="',
      `( ${installScript} )`,
      'INSTALL_STATUS=$?',
      'if [ $INSTALL_STATUS -ne 0 ]; then',
      '  echo "=== STEP: install FAILED (code $INSTALL_STATUS) ===";',
      '  exit $INSTALL_STATUS;',
      'fi',
      'echo "=== STEP: install OK ==="',
      'echo "=== STEP: test ==="',
      'npm test',
      'TEST_STATUS=$?',
      'echo "=== STEP: test EXIT=$TEST_STATUS ==="',
      'if [ $TEST_STATUS -ne 0 ]; then',
      '  echo "=== STEP: test FAILED ===";',
      '  exit $TEST_STATUS;',
      'fi',
      'echo "=== STEP: test OK ==="',
    ].join('\n');

    logs.push('▶ Запускаем install + test в контейнере');

    const res = await runContainer({
      image: IMAGE,
      workDir: repoDir.path,
      command,
      timeoutMs: TOTAL_TIMEOUT,
      memoryMb: 2048,
      cpus: 2,
      network: 'bridge',
      env: {
        CI: 'true',
        NPM_CONFIG_FUND: 'false',
        NPM_CONFIG_AUDIT: 'false',
        NPM_CONFIG_UPDATE_NOTIFIER: 'false',
        NPM_CONFIG_LOGLEVEL: 'error',
        NPM_CONFIG_PRODUCTION: 'false',
        NODE_OPTIONS: '--max-old-space-size=1536',
      },
    });

    const combined = res.stdout + '\n' + res.stderr;

    const installFailed = combined.includes('=== STEP: install FAILED');
    const installOk = combined.includes('=== STEP: install OK ===');
    const testOk = combined.includes('=== STEP: test OK ===');
    const testFailed = combined.includes('=== STEP: test FAILED ===');

    const parsed = parseTestOutput(combined);
    if (parsed) {
      logs.push(
        `ℹ Тесты: passed=${parsed.passed ?? '?'}, failed=${parsed.failed ?? '?'}, total=${parsed.total ?? '?'}`,
      );
    }

    if (installFailed) {
      logs.push('✘ Установка зависимостей упала');
      logs.push(
        ...extractBetween(
          combined,
          '=== STEP: install ===',
          '=== STEP: install FAILED',
        ).slice(-40),
      );
      return {
        ok: false,
        logs,
        reason: 'install-failed',
        durationMs: Date.now() - t0,
        ...parsed,
      };
    }

    if (installOk) {
      logs.push('✔ Зависимости установлены');
      const installSection = extractBetween(
        combined,
        '=== STEP: install ===',
        '=== STEP: install OK ===',
      );
      logs.push(...installSection.slice(-6));
    }

    if (testOk) {
      logs.push('✔ Все тесты прошли');
      logs.push(
        ...extractBetween(
          combined,
          '=== STEP: test ===',
          '=== STEP: test OK ===',
        ).slice(-15),
      );
      return {
        ok: true,
        logs,
        durationMs: Date.now() - t0,
        ...parsed,
      };
    }

    if (testFailed) {
      logs.push('✘ Тесты упали');
      logs.push(
        ...extractBetween(
          combined,
          '=== STEP: test ===',
          '=== STEP: test FAILED',
        ).slice(-50),
      );
      return {
        ok: false,
        logs,
        reason: 'test-failed',
        durationMs: Date.now() - t0,
        ...parsed,
      };
    }

    if (res.timedOut) {
      logs.push(`✘ Таймаут ${TOTAL_TIMEOUT / 1000}с`);
      logs.push(...tail(combined, 30));
      return {
        ok: false,
        logs,
        reason: 'timeout',
        durationMs: Date.now() - t0,
        ...parsed,
      };
    }

    logs.push(`✘ Процесс завершился с кодом ${res.exitCode}`);
    logs.push(...tail(combined, 40));
    return {
      ok: false,
      logs,
      reason: 'unknown',
      durationMs: Date.now() - t0,
      ...parsed,
    };
  } catch (e) {
    logs.push(`✘ Ошибка: ${(e as Error).message}`);
    return {
      ok: false,
      logs,
      reason: 'exception',
      durationMs: Date.now() - t0,
    };
  } finally {
    if (repoDir) await repoDir.cleanup();
  }
}

function parseTestOutput(text: string): {
  passed?: number;
  failed?: number;
  total?: number;
} | null {
  const result: { passed?: number; failed?: number; total?: number } = {};

  const jest = text.match(
    /Tests:\s*(?:(\d+)\s*failed,\s*)?(?:(\d+)\s*passed,\s*)?(\d+)\s*total/,
  );
  if (jest) {
    result.failed = jest[1] ? Number(jest[1]) : 0;
    result.passed = jest[2] ? Number(jest[2]) : 0;
    result.total = Number(jest[3]);
    return result;
  }

  const vitest = text.match(
    /Tests\s+(?:(\d+)\s*failed\s*\|\s*)?(\d+)\s*passed\s*\((\d+)\)/,
  );
  if (vitest) {
    result.failed = vitest[1] ? Number(vitest[1]) : 0;
    result.passed = Number(vitest[2]);
    result.total = Number(vitest[3]);
    return result;
  }

  const mochaPass = text.match(/(\d+)\s+passing/);
  const mochaFail = text.match(/(\d+)\s+failing/);
  if (mochaPass || mochaFail) {
    result.passed = mochaPass ? Number(mochaPass[1]) : 0;
    result.failed = mochaFail ? Number(mochaFail[1]) : 0;
    result.total = (result.passed ?? 0) + (result.failed ?? 0);
    return result;
  }

  return Object.keys(result).length > 0 ? result : null;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function tail(text: string, lines: number): string[] {
  return text
    .trim()
    .split('\n')
    .filter((l) => l.length > 0)
    .slice(-lines);
}

function extractBetween(text: string, start: string, end: string): string[] {
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i === -1) return [];
  const slice = text.slice(i + start.length, j === -1 ? undefined : j);
  return slice
    .trim()
    .split('\n')
    .filter((l) => l.length > 0);
}