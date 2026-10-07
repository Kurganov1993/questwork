type Waiter = {
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
  timer: NodeJS.Timeout;
};

const MAX_CONCURRENT = 1;
const MAX_QUEUE = 3;
const QUEUE_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

let activeBuilds = 0;
const queue: Waiter[] = [];

export type AcquireResult = {
  release: () => void;
  queuePosition: number; // 0 если сразу получил
  waitMs: number;
};

/**
 * Пытается получить слот на сборку.
 * Если все заняты — встаёт в очередь (максимум MAX_QUEUE).
 * Бросает ошибку, если очередь переполнена или таймаут.
 */
export async function acquireBuildSlot(): Promise<AcquireResult> {
  if (activeBuilds < MAX_CONCURRENT) {
    activeBuilds++;
    return makeRelease(0, 0);
  }

  if (queue.length >= MAX_QUEUE) {
    throw new Error(
      'Очередь сборок переполнена. Попробуй через 5–10 минут.',
    );
  }

  const startedWait = Date.now();
  const position = queue.length + 1;

  return new Promise<AcquireResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = queue.findIndex((w) => w.timer === timer);
      if (idx !== -1) queue.splice(idx, 1);
      reject(new Error('Превышено время ожидания в очереди (5 мин)'));
    }, QUEUE_TIMEOUT_MS);

    const waiter: Waiter = {
      resolve,
      reject,
      enqueuedAt: startedWait,
      timer,
    };

    queue.push(waiter);

    // Обёртка для resolve — учитываем позицию и время
    const origResolve = waiter.resolve;
    waiter.resolve = (release: () => void) => {
      clearTimeout(timer);
      origResolve(makeRelease(position, Date.now() - startedWait, release));
    };
  });
}

function makeRelease(
  queuePosition: number,
  waitMs: number,
  upstreamRelease?: () => void,
): AcquireResult {
  let released = false;

  return {
    queuePosition,
    waitMs,
    release: () => {
      if (released) return;
      released = true;

      if (upstreamRelease) {
        upstreamRelease();
        return;
      }

      activeBuilds = Math.max(0, activeBuilds - 1);

      // Отпускаем следующего из очереди
      const next = queue.shift();
      if (next) {
        activeBuilds++;
        next.resolve(() => {
          activeBuilds = Math.max(0, activeBuilds - 1);
          const after = queue.shift();
          if (after) {
            activeBuilds++;
            after.resolve(() => {
              activeBuilds = Math.max(0, activeBuilds - 1);
            });
          }
        });
      }
    },
  };
}

export function getBuildQueueStats() {
  return {
    active: activeBuilds,
    queued: queue.length,
    maxConcurrent: MAX_CONCURRENT,
    maxQueue: MAX_QUEUE,
  };
}

export function getQueuePosition(): number {
  return queue.length;
}