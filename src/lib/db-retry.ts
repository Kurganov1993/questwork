export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelay = options.baseDelayMs ?? 500;
  const label = options.label ?? 'db-op';

  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isNetwork =
        e instanceof Error &&
        (/fetch failed/i.test(e.message) ||
          /Error connecting to database/i.test(e.message) ||
          /ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(e.message));

      console.warn(
        `[${label}] attempt ${i}/${attempts} failed${isNetwork ? ' (network)' : ''}:`,
        (e as Error).message,
      );

      if (i === attempts) break;
      const delay = baseDelay * Math.pow(2, i - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}