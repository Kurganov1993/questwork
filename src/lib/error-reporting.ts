import { logger } from './logger';

const DSN = process.env.SENTRY_DSN?.trim() ?? '';

export type ErrorContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: { id: number; nickname?: string };
};

/**
 * Логирует ошибку локально и (если задан SENTRY_DSN) отправляет в Sentry.
 * Никогда не бросает — ошибки репортинга не должны ломать основной поток.
 */
export async function reportError(
  error: unknown,
  context: ErrorContext = {},
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));

  logger.error('app.error', {
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 5).join(' | '),
    ...context.tags,
    ...context.extra,
    userId: context.user?.id,
  });

  if (!DSN) return;

  try {
    const dsn = new URL(DSN);
    const publicKey = dsn.username;
    const projectId = dsn.pathname.replace(/^\//, '');
    const endpoint = `${dsn.protocol}//${dsn.host}/api/${projectId}/store/`;

    // Sentry хочет 32-символьный hex event_id
    const eventId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');

    const body = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      logger: 'questwork',
      release: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      environment: process.env.NODE_ENV ?? 'development',
      message: { formatted: err.message },
      exception: {
        values: [
          {
            type: err.name,
            value: err.message,
          },
        ],
      },
      tags: context.tags,
      extra: context.extra,
      user: context.user
        ? { id: String(context.user.id), username: context.user.nickname }
        : undefined,
    };

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=questwork/1.0`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      /* молча игнорируем */
    });
  } catch (e) {
    logger.warn('error-reporting.failed', {
      message: (e as Error).message,
    });
  }
}