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
const TOTAL_TIMEOUT = 480_000; // 8 минут на install + build

export type BuildResult = {
  ok: boolean;
  logs: string[];
  reason?: string;
  durationMs: number;
};

export async function runBuildCheck(
  owner: string,
  repo: string,
  branch: string,
): Promise<BuildResult> {
  const t0 = Date.now();
  const logs: string[] = [];

  if (!(await isDockerAvailable())) {
    return {
      ok: false,
      logs: ['✘ Docker недоступен — реальная сборка пропущена'],
      reason: 'docker-unavailable',
      durationMs: Date.now() - t0,
    };
  }

  let repoDir: Awaited<ReturnType<typeof fetchRepoToTemp>> | null = null;

  try {
    repoDir = await fetchRepoToTemp(owner, repo, branch);
    logs.push('✔ Исходники скачаны во временную папку');

    let pkg: Record<string, unknown> | null = null;
    try {
      const raw = await readFile(join(repoDir.path, 'package.json'), 'utf-8');
      pkg = JSON.parse(raw);
    } catch {
      logs.push('✘ package.json не найден в корне');
      return {
        ok: false,
        logs,
        reason: 'no-package-json',
        durationMs: Date.now() - t0,
      };
    }

    const scripts = (pkg?.scripts as Record<string, string>) ?? {};
    if (!scripts.build) {
      logs.push('✘ В package.json нет скрипта "build"');
      return {
        ok: false,
        logs,
        reason: 'no-build-script',
        durationMs: Date.now() - t0,
      };
    }
    logs.push(`✔ Скрипт build: ${scripts.build}`);

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
      // --include=dev гарантирует, что devDependencies (typescript, eslint,
      // jest и т.п.) будут поставлены даже при NODE_ENV=production
      installScript = 'npm install --no-audit --no-fund --include=dev';
    }

    // Одна команда: install + build в одном контейнере.
    // Каждый runContainer создаёт новый контейнер, поэтому node_modules
    // не переживает между вызовами — всё должно быть в одном.
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
      'echo "=== STEP: build ==="',
      'npm run build',
      'BUILD_STATUS=$?',
      'if [ $BUILD_STATUS -ne 0 ]; then',
      '  echo "=== STEP: build FAILED (code $BUILD_STATUS) ===";',
      '  exit $BUILD_STATUS;',
      'fi',
      'echo "=== STEP: build OK ==="',
    ].join('\n');

    logs.push('▶ Запускаем install + build в контейнере');

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
    const buildFailed = combined.includes('=== STEP: build FAILED');
    const buildOk = combined.includes('=== STEP: build OK ===');

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
      };
    }

    if (installOk) {
      logs.push('✔ Зависимости установлены');
      const installSection = extractBetween(
        combined,
        '=== STEP: install ===',
        '=== STEP: install OK ===',
      );
      logs.push(...installSection.slice(-8));
    }

    if (buildOk) {
      logs.push('✔ Сборка прошла успешно');
      const buildSection = extractBetween(
        combined,
        '=== STEP: build ===',
        '=== STEP: build OK ===',
      );
      logs.push(...buildSection.slice(-15));
      return { ok: true, logs, durationMs: Date.now() - t0 };
    }

    if (buildFailed) {
      logs.push('✘ Сборка упала');
      const buildSection = extractBetween(
        combined,
        '=== STEP: build ===',
        '=== STEP: build FAILED',
      );
      logs.push(...buildSection.slice(-50));
      return {
        ok: false,
        logs,
        reason: 'build-failed',
        durationMs: Date.now() - t0,
      };
    }

    if (res.timedOut) {
      logs.push(`✘ Общий таймаут ${TOTAL_TIMEOUT / 1000}с`);
      logs.push(...tail(combined, 30));
      return {
        ok: false,
        logs,
        reason: 'timeout',
        durationMs: Date.now() - t0,
      };
    }

    if (res.oomKilled) {
      logs.push('✘ Процесс убит из-за нехватки памяти');
      logs.push(...tail(combined, 20));
      return {
        ok: false,
        logs,
        reason: 'oom',
        durationMs: Date.now() - t0,
      };
    }

    logs.push(`✘ Процесс завершился с кодом ${res.exitCode}`);
    logs.push(...tail(combined, 40));
    return {
      ok: false,
      logs,
      reason: 'unknown',
      durationMs: Date.now() - t0,
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