import { spawn } from 'node:child_process';

export type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  oomKilled: boolean;
};

let dockerAvailable: boolean | null = null;

export async function isDockerAvailable(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    const r = await runProcess(
      'docker',
      ['version', '--format', '{{.Server.Version}}'],
      5000,
    );
    dockerAvailable = r.exitCode === 0 && /^\d/.test(r.stdout.trim());
  } catch {
    dockerAvailable = false;
  }
  return dockerAvailable;
}

export async function imageExists(image: string): Promise<boolean> {
  const r = await runProcess('docker', ['image', 'inspect', image], 5000);
  return r.exitCode === 0;
}

export async function pullImage(image: string): Promise<boolean> {
  const r = await runProcess('docker', ['pull', image], 180_000);
  return r.exitCode === 0;
}

/**
 * Проверяет, существует ли Docker volume, и создаёт его, если нет.
 * Это кэш для npm — сохраняется между запусками контейнеров,
 * экономит 60–90 секунд на каждой установке зависимостей.
 */
async function ensureVolume(name: string): Promise<void> {
  const check = await runProcess('docker', ['volume', 'inspect', name], 5_000);
  if (check.exitCode === 0) return;
  await runProcess('docker', ['volume', 'create', name], 10_000);
}

export type ContainerRunOpts = {
  image: string;
  workDir: string;
  command: string;
  timeoutMs: number;
  memoryMb?: number;
  cpus?: number;
  network?: 'none' | 'bridge';
  env?: Record<string, string>;
};

/**
 * Запускает контейнер БЕЗ монтирования папки.
 * Файлы копируются через `docker cp` — это в 10–30 раз быстрее
 * на Windows, где bind-mount через virtiofs очень медленный.
 *
 * Особенности:
 *   - volume `questwork-npm-cache` монтируется в /root/.npm —
 *     переиспользуем npm-кэш между всеми контейнерами.
 *   - Работаем в /workspace, куда копируются исходники.
 */
export async function runContainer(opts: ContainerRunOpts): Promise<RunResult> {
  const {
    image,
    workDir,
    command,
    timeoutMs,
    memoryMb = 2048,
    cpus = 2,
    network = 'bridge',
    env = {},
  } = opts;

  const name = `qw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const t0 = Date.now();

  try {
    // Готовим volume для npm-кэша (создаётся один раз)
    await ensureVolume('questwork-npm-cache');

    const createArgs: string[] = [
      'create',
      '--name', name,
      '--memory', `${memoryMb}m`,
      '--cpus', String(cpus),
      '--network', network,
      '--workdir', '/workspace',
      '--tmpfs', '/tmp:rw,size=512m',
      // Кэш npm
      '-v', 'questwork-npm-cache:/root/.npm',
    ];
    for (const [k, v] of Object.entries(env)) {
      createArgs.push('-e', `${k}=${v}`);
    }
    createArgs.push(image, 'sh', '-c', command);

    const created = await runProcess('docker', createArgs, 30_000);
    if (created.exitCode !== 0) {
      return {
        exitCode: -1,
        stdout: '',
        stderr: `docker create failed: ${created.stderr}`,
        durationMs: Date.now() - t0,
        timedOut: false,
        oomKilled: false,
      };
    }

    // Копируем исходники внутрь контейнера
    const normalizedDir = workDir.replace(/\\/g, '/');
    const cp = await runProcess(
      'docker',
      ['cp', `${normalizedDir}/.`, `${name}:/workspace`],
      300_000,
    );
    if (cp.exitCode !== 0) {
      await runProcess('docker', ['rm', '-f', name], 15_000);
      return {
        exitCode: -1,
        stdout: '',
        stderr: `docker cp failed: ${cp.stderr}`,
        durationMs: Date.now() - t0,
        timedOut: false,
        oomKilled: false,
      };
    }

    const start = await runProcess('docker', ['start', name], 30_000);
    if (start.exitCode !== 0) {
      await runProcess('docker', ['rm', '-f', name], 15_000);
      return {
        exitCode: -1,
        stdout: '',
        stderr: `docker start failed: ${start.stderr}`,
        durationMs: Date.now() - t0,
        timedOut: false,
        oomKilled: false,
      };
    }

    const waited = await runProcess('docker', ['wait', name], timeoutMs);
    const timedOut = waited.timedOut;

    if (timedOut) {
      await runProcess('docker', ['kill', name], 15_000);
    }

    const logs = await runProcess('docker', ['logs', name], 30_000);

    let exitCode = -1;
    const inspect = await runProcess(
      'docker',
      ['inspect', '--format', '{{.State.ExitCode}}', name],
      10_000,
    );
    if (inspect.exitCode === 0) {
      const parsed = parseInt(inspect.stdout.trim(), 10);
      if (Number.isFinite(parsed)) exitCode = parsed;
    }

    const combined = logs.stdout + '\n' + logs.stderr;
    const oomKilled = /Killed|OOMKilled|Out of memory/i.test(combined);

    return {
      exitCode: timedOut ? 124 : exitCode,
      stdout: logs.stdout,
      stderr: logs.stderr,
      durationMs: Date.now() - t0,
      timedOut,
      oomKilled,
    };
  } catch (e) {
    return {
      exitCode: -1,
      stdout: '',
      stderr: (e as Error).message,
      durationMs: Date.now() - t0,
      timedOut: false,
      oomKilled: false,
    };
  } finally {
    await runProcess('docker', ['rm', '-f', name], 15_000).catch(() => {});
  }
}

function runProcess(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, args, { windowsHide: true, shell: false });
    } catch (e) {
      resolve({
        exitCode: -1,
        stdout: '',
        stderr: (e as Error).message,
        durationMs: 0,
        timedOut: false,
        oomKilled: false,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const MAX = 500_000;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX) stdout += chunk.toString('utf-8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX) stderr += chunk.toString('utf-8');
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        timedOut,
        oomKilled: /Killed|OOMKilled|Out of memory/i.test(stderr),
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\n' + err.message,
        durationMs: Date.now() - start,
        timedOut,
        oomKilled: false,
      });
    });
  });
}