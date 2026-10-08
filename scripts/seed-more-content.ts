import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql } from 'drizzle-orm';
import { quests, bossPhases, artifacts, achievements } from '../src/db/schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

type PhaseSeed = {
  phaseOrder: number;
  name: string;
  description: string;
  checkType: string;
  maxHp: number;
};

type QuestSeed = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  bossName: string;
  bossMaxHp: number;
  difficulty: number;
  rewardXp: number;
  rewardGold: number;
  victoryThreshold: number;
  artifact: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  };
  phases: PhaseSeed[];
};

const NEW_QUESTS: QuestSeed[] = [
  {
    slug: 'write-rest-api',
    title: 'Написать REST API',
    description:
      'Лорд Эндпоинтов требует порядок в бэкенде. Построй REST API с роутами, валидацией, тестами и документацией, чтобы получить его благословение.',
    icon: '🛰️',
    bossName: 'Лорд Эндпоинтов',
    bossMaxHp: 120,
    difficulty: 2,
    rewardXp: 700,
    rewardGold: 50,
    victoryThreshold: 65,
    artifact: {
      slug: 'endpoint-scepter',
      name: 'Скипетр Эндпоинтов',
      description:
        'Артефакт backend-разработчика. Каждый маршрут теперь под контролем.',
      icon: '🛡️',
      rarity: 'rare',
    },
    phases: [
      { phaseOrder: 1, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
      { phaseOrder: 2, name: 'README и структура', description: 'Есть README, осмысленные коммиты.', checkType: 'readme', maxHp: 10 },
      { phaseOrder: 3, name: 'Docker сборка', description: 'npm install и npm run build реально проходят.', checkType: 'build_real', maxHp: 15 },
      { phaseOrder: 4, name: 'Тесты проходят', description: 'npm test реально проходит в контейнере.', checkType: 'tests_real', maxHp: 20 },
      { phaseOrder: 5, name: 'Статический анализ', description: 'ESLint и Semgrep находят стиль и уязвимости.', checkType: 'static_analysis', maxHp: 10 },
      { phaseOrder: 6, name: 'Безопасность', description: 'Нет секретов, есть .gitignore.', checkType: 'secrets', maxHp: 10 },
      { phaseOrder: 7, name: 'Деплой живой', description: 'Ссылка на задеплоенное API работает.', checkType: 'deploy', maxHp: 20 },
      { phaseOrder: 8, name: 'AI-ревью кода', description: 'LLM читает код и даёт замечания по архитектуре.', checkType: 'review_ai', maxHp: 15 },
    ],
  },
  {
    slug: 'cover-legacy-with-tests',
    title: 'Покрыть legacy тестами',
    description:
      'Дракон Технического Долга держит старый код в цепях. Напиши тесты и настрой coverage, чтобы разбить оковы.',
    icon: '🧪',
    bossName: 'Дракон Технического Долга',
    bossMaxHp: 100,
    difficulty: 2,
    rewardXp: 600,
    rewardGold: 45,
    victoryThreshold: 65,
    artifact: {
      slug: 'testers-lens',
      name: 'Линза Тестировщика',
      description: 'Артефакт QA. Показывает баги там, где их не должно быть.',
      icon: '🔍',
      rarity: 'rare',
    },
    phases: [
      { phaseOrder: 1, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
      { phaseOrder: 2, name: 'README и структура', description: 'Есть README, осмысленные коммиты.', checkType: 'readme', maxHp: 10 },
      { phaseOrder: 3, name: 'Docker сборка', description: 'Проект собирается в контейнере.', checkType: 'build_real', maxHp: 15 },
      { phaseOrder: 4, name: 'Тесты проходят', description: 'npm test реально проходит. Ключевая фаза квеста.', checkType: 'tests_real', maxHp: 30 },
      { phaseOrder: 5, name: 'Статический анализ', description: 'ESLint и Semgrep.', checkType: 'static_analysis', maxHp: 10 },
      { phaseOrder: 6, name: 'Безопасность', description: 'Нет секретов, есть .gitignore.', checkType: 'secrets', maxHp: 10 },
      { phaseOrder: 7, name: 'AI-ревью кода', description: 'LLM оценивает качество тестов и архитектуру.', checkType: 'review_ai', maxHp: 15 },
    ],
  },
  {
    slug: 'optimize-sql-queries',
    title: 'Оптимизировать запросы в БД',
    description:
      'Древний Био-Инженер задыхается от N+1 запросов. Оптимизируй доступ к базе, добавь индексы — и он отпустит свои данные.',
    icon: '⚡',
    bossName: 'Древний Био-Инженер',
    bossMaxHp: 115,
    difficulty: 3,
    rewardXp: 900,
    rewardGold: 70,
    victoryThreshold: 70,
    artifact: {
      slug: 'index-amulet',
      name: 'Амулет Индексов',
      description: 'Артефакт оптимизатора. Запросы ускоряются в разы.',
      icon: '💠',
      rarity: 'epic',
    },
    phases: [
      { phaseOrder: 1, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
      { phaseOrder: 2, name: 'README и структура', description: 'Есть README, осмысленные коммиты.', checkType: 'readme', maxHp: 10 },
      { phaseOrder: 3, name: 'Docker сборка', description: 'Проект собирается в контейнере.', checkType: 'build_real', maxHp: 15 },
      { phaseOrder: 4, name: 'Тесты проходят', description: 'npm test проходит.', checkType: 'tests_real', maxHp: 15 },
      { phaseOrder: 5, name: 'Статический анализ', description: 'ESLint + Semgrep.', checkType: 'static_analysis', maxHp: 10 },
      { phaseOrder: 6, name: 'Безопасность', description: 'Нет секретов в коде.', checkType: 'secrets', maxHp: 10 },
      { phaseOrder: 7, name: 'AI-ревью кода', description: 'LLM ищет N+1, отсутствие индексов, проблемы производительности.', checkType: 'review_ai', maxHp: 20 },
      { phaseOrder: 8, name: 'Деплой живой', description: 'Задеплоенное приложение отвечает.', checkType: 'deploy', maxHp: 25 },
    ],
  },
  {
    slug: 'setup-monitoring',
    title: 'Развернуть мониторинг',
    description:
      'Слепой Маячник скрывает состояние системы. Разверни health-check, логи и метрики, чтобы осветить путь.',
    icon: '📡',
    bossName: 'Слепой Маячник',
    bossMaxHp: 110,
    difficulty: 3,
    rewardXp: 850,
    rewardGold: 65,
    victoryThreshold: 70,
    artifact: {
      slug: 'lantern-of-observability',
      name: 'Фонарь Наблюдаемости',
      description: 'Артефакт DevOps. Видно всё, что происходит в системе.',
      icon: '🏮',
      rarity: 'epic',
    },
    phases: [
      { phaseOrder: 1, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
      { phaseOrder: 2, name: 'README и структура', description: 'Есть README, описан мониторинг.', checkType: 'readme', maxHp: 10 },
      { phaseOrder: 3, name: 'Docker сборка', description: 'Проект собирается в контейнере.', checkType: 'build_real', maxHp: 15 },
      { phaseOrder: 4, name: 'Тесты проходят', description: 'npm test проходит.', checkType: 'tests_real', maxHp: 15 },
      { phaseOrder: 5, name: 'Статический анализ', description: 'ESLint + Semgrep.', checkType: 'static_analysis', maxHp: 10 },
      { phaseOrder: 6, name: 'Деплой живой', description: 'Health-endpoint отвечает на запросы.', checkType: 'deploy', maxHp: 25 },
      { phaseOrder: 7, name: 'Безопасность', description: 'Нет утечек секретов.', checkType: 'secrets', maxHp: 10 },
      { phaseOrder: 8, name: 'AI-ревью кода', description: 'LLM оценивает логи, метрики, обработку ошибок.', checkType: 'review_ai', maxHp: 15 },
    ],
  },
];

type AchievementSeed = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  conditionType: string;
  conditionValue: string | null;
  xpReward: number;
  goldReward: number;
};

const NEW_ACHIEVEMENTS: AchievementSeed[] = [
  {
    slug: 'backend-master',
    name: 'Повелитель API',
    description: 'Победить Лорда Эндпоинтов.',
    icon: '🛰️',
    conditionType: 'defeat_boss_with_slug',
    conditionValue: 'write-rest-api',
    xpReward: 300,
    goldReward: 50,
  },
  {
    slug: 'coverage-hero',
    name: 'Покрыватель',
    description: 'Победить Дракона Технического Долга.',
    icon: '🧪',
    conditionType: 'defeat_boss_with_slug',
    conditionValue: 'cover-legacy-with-tests',
    xpReward: 300,
    goldReward: 50,
  },
  {
    slug: 'optimizer',
    name: 'Оптимизатор',
    description: 'Победить Древнего Био-Инженера.',
    icon: '⚡',
    conditionType: 'defeat_boss_with_slug',
    conditionValue: 'optimize-sql-queries',
    xpReward: 400,
    goldReward: 70,
  },
  {
    slug: 'observer',
    name: 'Наблюдатель',
    description: 'Победить Слепого Маячника.',
    icon: '📡',
    conditionType: 'defeat_boss_with_slug',
    conditionValue: 'setup-monitoring',
    xpReward: 400,
    goldReward: 70,
  },
  {
    slug: 'multiclass',
    name: 'Мультикласс',
    description: 'Победить боссов 4 разных квестов.',
    icon: '🎭',
    conditionType: 'bosses_unique',
    conditionValue: '4',
    xpReward: 500,
    goldReward: 100,
  },
  {
    slug: 'boss-conqueror',
    name: 'Покоритель боссов',
    description: 'Победить всех системных боссов платформы.',
    icon: '👑',
    conditionType: 'all_system_bosses',
    conditionValue: null,
    xpReward: 1000,
    goldReward: 300,
  },
];

/**
 * Retry-обёртка для нестабильного соединения с Neon.
 * 3 попытки с экспоненциальной задержкой.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = (e as Error).message.slice(0, 120);
      console.warn(`  ⚠ ${label}: попытка ${i}/${attempts} — ${msg}`);
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 500 * i));
      }
    }
  }
  throw lastError;
}

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('=== КВЕСТЫ ===');
  for (const q of NEW_QUESTS) {
    try {
      const existing = await withRetry(
        () =>
          db
            .select({ id: quests.id })
            .from(quests)
            .where(eq(quests.slug, q.slug)),
        `check ${q.slug}`,
      );

      let questId: number;

      if (existing.length > 0) {
        questId = existing[0].id;

        await withRetry(
          () =>
            db
              .update(quests)
              .set({
                title: q.title,
                description: q.description,
                icon: q.icon,
                bossName: q.bossName,
                bossMaxHp: q.bossMaxHp,
                difficulty: q.difficulty,
                rewardXp: q.rewardXp,
                rewardGold: q.rewardGold,
                victoryThreshold: q.victoryThreshold,
                status: 'active',
              })
              .where(eq(quests.id, questId)),
          `update ${q.slug}`,
        );

        await withRetry(
          () => db.delete(bossPhases).where(eq(bossPhases.questId, questId)),
          `delete phases ${q.slug}`,
        );

        console.log(`↻ Обновлён квест: ${q.slug} (id=${questId})`);
      } else {
        const [created] = await withRetry(
          () =>
            db
              .insert(quests)
              .values({
                slug: q.slug,
                title: q.title,
                description: q.description,
                icon: q.icon,
                bossName: q.bossName,
                bossMaxHp: q.bossMaxHp,
                difficulty: q.difficulty,
                rewardXp: q.rewardXp,
                rewardGold: q.rewardGold,
                victoryThreshold: q.victoryThreshold,
                status: 'active',
              })
              .returning(),
          `insert ${q.slug}`,
        );

        questId = created.id;
        console.log(`+ Создан квест: ${q.slug} (id=${questId})`);
      }

      await withRetry(
        () =>
          db.insert(bossPhases).values(
            q.phases.map((p) => ({
              questId,
              phaseOrder: p.phaseOrder,
              name: p.name,
              description: p.description,
              checkType: p.checkType,
              maxHp: p.maxHp,
            })),
          ),
        `phases ${q.slug}`,
      );

      const existingArtifact = await withRetry(
        () =>
          db
            .select({ id: artifacts.id })
            .from(artifacts)
            .where(eq(artifacts.slug, q.artifact.slug)),
        `check artifact ${q.artifact.slug}`,
      );

      if (existingArtifact.length > 0) {
        await withRetry(
          () =>
            db
              .update(artifacts)
              .set({
                name: q.artifact.name,
                description: q.artifact.description,
                icon: q.artifact.icon,
                rarity: q.artifact.rarity,
                questId,
              })
              .where(eq(artifacts.slug, q.artifact.slug)),
          `update artifact ${q.artifact.slug}`,
        );
      } else {
        await withRetry(
          () =>
            db.insert(artifacts).values({
              slug: q.artifact.slug,
              name: q.artifact.name,
              description: q.artifact.description,
              icon: q.artifact.icon,
              rarity: q.artifact.rarity,
              questId,
            }),
          `insert artifact ${q.artifact.slug}`,
        );
      }
    } catch (e) {
      console.error(
        `✘ Не удалось обработать квест ${q.slug}:`,
        (e as Error).message.slice(0, 200),
      );
      console.error('  Продолжаем со следующим квестом.\n');
    }
  }

  console.log('');
  console.log('=== ДОСТИЖЕНИЯ ===');
  for (const a of NEW_ACHIEVEMENTS) {
    try {
      const existing = await withRetry(
        () =>
          db
            .select({ id: achievements.id })
            .from(achievements)
            .where(eq(achievements.slug, a.slug)),
        `check ach ${a.slug}`,
      );

      if (existing.length > 0) {
        await withRetry(
          () =>
            db
              .update(achievements)
              .set({
                name: a.name,
                description: a.description,
                icon: a.icon,
                conditionType: a.conditionType,
                conditionValue: a.conditionValue,
                xpReward: a.xpReward,
                goldReward: a.goldReward,
              })
              .where(eq(achievements.slug, a.slug)),
          `update ach ${a.slug}`,
        );

        console.log(`↻ Обновлено: ${a.slug}`);
      } else {
        await withRetry(
          () => db.insert(achievements).values(a),
          `insert ach ${a.slug}`,
        );
        console.log(`+ Добавлено: ${a.slug}`);
      }
    } catch (e) {
      console.error(
        `✘ Не удалось обработать достижение ${a.slug}:`,
        (e as Error).message.slice(0, 200),
      );
    }
  }

  console.log('');

  try {
    const [questCount] = await withRetry(
      () =>
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(quests)
          .where(eq(quests.status, 'active')),
      'count quests',
    );
    const [achCount] = await withRetry(
      () =>
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(achievements),
      'count achievements',
    );

    console.log(`Всего активных квестов: ${questCount?.n ?? 0}`);
    console.log(`Всего достижений: ${achCount?.n ?? 0}`);
  } catch (e) {
    console.warn('Не удалось получить финальную сводку:', (e as Error).message);
  }

  console.log('');
  console.log('✅ Сид завершён.');
}

seed().catch((e) => {
  console.error('Критическая ошибка:', e);
  process.exit(1);
});