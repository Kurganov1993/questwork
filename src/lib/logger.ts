type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const IS_PROD = process.env.NODE_ENV === 'production';
const MIN_LEVEL: Level =
  (process.env.LOG_LEVEL as Level) ?? (IS_PROD ? 'info' : 'debug');

function shouldLog(level: Level) {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  if (IS_PROD) {
    const payload = {
      level,
      time: new Date().toISOString(),
      event,
      service: 'questwork',
      ...data,
    };
    const stream =
      level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    stream.write(JSON.stringify(payload) + '\n');
    return;
  }

  // Dev: цветной вывод
  const icon =
    level === 'error'
      ? '✗'
      : level === 'warn'
      ? '⚠'
      : level === 'info'
      ? 'ℹ'
      : '·';
  const color =
    level === 'error'
      ? '\x1b[31m'
      : level === 'warn'
      ? '\x1b[33m'
      : level === 'info'
      ? '\x1b[36m'
      : '\x1b[90m';
  const reset = '\x1b[0m';

  const extra =
    data && Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : '';
  // eslint-disable-next-line no-console
  console.log(`${color}${icon}${reset} ${event}${extra}`);
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) =>
    emit('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) =>
    emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) =>
    emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) =>
    emit('error', event, data),
};