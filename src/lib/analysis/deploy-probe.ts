import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export type ProbeResult = {
  status: number | null;
  ms: number;
  method: 'HEAD' | 'GET' | 'fetch';
  error?: string;
  viaCurl: boolean;
};

const isWindows = process.platform === 'win32';
const CURL_BIN = isWindows ? 'curl.exe' : 'curl';

/**
 * Проверка URL с приоритетом curl.exe (на Windows — Schannel),
 * чтобы обойти DPI-блокировку по TLS-фингерпринту Node/OpenSSL.
 */
export async function probeUrl(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
): Promise<ProbeResult> {
  const started = Date.now();
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));

  // 1. Пробуем curl
  try {
    const args = [
      '-s',                    // silent
      '-o', isWindows ? 'NUL' : '/dev/null', // discard body
      '-w', '%{http_code}',    // вывести только статус
      '--max-time', String(seconds),
      '--location',            // follow redirects
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QuestWork/1.0',
      '-X', method,
      url,
    ];

    const { stdout } = await exec(CURL_BIN, args, {
      timeout: timeoutMs + 5000,
      maxBuffer: 1024 * 1024,
    });

    const codeStr = stdout.trim();
    const status = codeStr ? Number(codeStr) : null;

    if (status && status > 0) {
      return {
        status,
        ms: Date.now() - started,
        method,
        viaCurl: true,
      };
    }

    return {
      status: null,
      ms: Date.now() - started,
      method,
      error: 'curl вернул пустой статус',
      viaCurl: true,
    };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const codeFromStdout = err.stdout?.trim();
    const status = codeFromStdout ? Number(codeFromStdout) : null;

    // curl вернул код, но с ненулевым exit — например 404
    if (status && status > 0) {
      return {
        status,
        ms: Date.now() - started,
        method,
        viaCurl: true,
      };
    }

    // curl не установлен / упал — идём в fallback
    if (/ENOENT|not found/i.test(err.message ?? '')) {
      return fetchFallback(url, method, timeoutMs, started);
    }

    return {
      status: null,
      ms: Date.now() - started,
      method,
      error: `curl: ${err.message ?? 'unknown'}`,
      viaCurl: true,
    };
  }
}

async function fetchFallback(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
  started: number,
): Promise<ProbeResult> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QuestWork/1.0',
        Accept: 'text/html,*/*',
      },
    });
    clearTimeout(t);
    return {
      status: res.status,
      ms: Date.now() - started,
      method: 'fetch',
      viaCurl: false,
    };
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const cause = err.cause as (Error & { code?: string }) | undefined;
    const details = cause
      ? `${err.message}: ${cause.message}${cause.code ? ` [${cause.code}]` : ''}`
      : err.message || 'unknown';
    return {
      status: null,
      ms: Date.now() - started,
      method: 'fetch',
      error: details,
      viaCurl: false,
    };
  }
}