import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import {
  quests,
  bossPhases,
  artifacts,
  achievements,
  heroAchievements,
} from './schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

type PhaseSeed = {
  phaseOrder: number;
  name: string;
  description: string;
  checkType: string;
  maxHp: number;
};

type ArtifactSeed = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
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
  phases: PhaseSeed[];
  artifact: ArtifactSeed;
};

const QUESTS: QuestSeed[] = [
  {
    slug: 'create-shop',
    title: 'Создать интернет-магазин',
    description:
      'Древний Торговец захватил рынок. Постройте витрину, корзину и оформление заказа, чтобы сразить его.',
    icon: '🛒',
    bossName: 'Древний Торговец',
    bossMaxHp: 110,
    difficulty: 1,
    rewardXp: 500,
    rewardGold: 30,
    victoryThreshold: 65,
    artifact: {
      slug: 'ring-of-vitrines',
      name: 'Кольцо Витрин',
      description:
        'Артефакт первого квеста. Даёт +1 к уверенности в вёрстке.',
      icon: '💍',
      rarity: 'common',
    },
    phases: [
      { phaseOrder: 1, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
      { phaseOrder: 2, name: 'README и структура', description: 'Есть README, осмысленные коммиты.', checkType: 'readme', maxHp: 10 },
      { phaseOrder: 3, name: 'Сборка проекта', description: 'Есть package.json и скрипт build.', checkType: 'build_config', maxHp: 15 },
      { phaseOrder: 4, name: 'Статический анализ', description: 'ESLint и Semgrep: стиль, уязвимости, секреты.', checkType: 'static_analysis', maxHp: 10 },
      { phaseOrder: 5, name: 'Тесты проходят', description: 'Есть конфигурация тестов и тестовые файлы.', checkType: 'tests', maxHp: 15 },
      { phaseOrder: 6, name: 'Деплой живой', description: 'Ссылка на задеплоенное приложение работает.', checkType: 'deploy', maxHp: 20 },
      { phaseOrder: 7, name: 'E2E-сценарий', description: 'Настроены end-to-end тесты (Playwright/Cypress).', checkType: 'e2e', maxHp: 15 },
      { phaseOrder: 8, name: 'Безопасность', description: 'Нет секретов, есть .gitignore.', checkType: 'secrets', maxHp: 10 },
      { phaseOrder: 9, name: 'Ревью наставника', description: 'Качество архитектуры и читаемость.', checkType: 'review', maxHp: 5 },
    ],
  },
  {
    slug: 'ci-cd-pipeline',
    title: 'Настроить CI/CD',
    description:
      'Лорд Пайплайнов держит деплой в цепях. Построй конвейер: lint, test, build, deploy — и освободи релиз.',
    icon: '⚙️',
    bossName: 'Лорд Пайплайнов',
    bossMaxHp: 115,
    difficulty: 2,
    rewardXp: 800,
    rewardGold: 60,
    victoryThreshold: 70,
    artifact: {
      slug: 'pipeline-hammer',
      name: 'Молот Пайплайнов',
      description:
        'Артефакт CI/CD. Каждый коммит теперь куют по-настоящему.',
      icon: '🔨',
      rarity: 'rare',
    },
    phases: [
      { phaseOrder: 1, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
      { phaseOrder: 2, name: 'Workflow-файл', description: 'Есть .github/workflows/*.yml.', checkType: 'ci_workflow', maxHp: 20 },
      { phaseOrder: 3, name: 'Lint-шаг', description: 'В workflow есть запуск линтера.', checkType: 'ci_lint', maxHp: 15 },
      { phaseOrder: 4, name: 'Test-шаг', description: 'В workflow запускаются тесты.', checkType: 'ci_test', maxHp: 20 },
      { phaseOrder: 5, name: 'Build-шаг', description: 'В workflow есть сборка проекта.', checkType: 'ci_build', maxHp: 15 },
      { phaseOrder: 6, name: 'Кэш зависимостей', description: 'Используется actions/cache или аналог.', checkType: 'ci_cache', maxHp: 10 },
      { phaseOrder: 7, name: 'Deploy-шаг', description: 'Есть шаг деплоя (vercel/netlify/ssh/docker).', checkType: 'cd_deploy', maxHp: 15 },
      { phaseOrder: 8, name: 'Секреты', description: 'Секреты через secrets, не в открытом виде.', checkType: 'secrets', maxHp: 10 },
    ],
  },
];

const ACHIEVEMENTS = [
  {
    slug: 'first-blood',
    name: 'Первая кровь',
    description: 'Одержать первую победу над боссом.',
    icon: '🩸',
    conditionType: 'victories_total',
    conditionValue: '1',
    xpReward: 100,
    goldReward: 10,
  },
  {
    slug: 'veteran',
    name: 'Ветеран',
    description: 'Одержать 5 побед.',
    icon: '🎖️',
    conditionType: 'victories_total',
    conditionValue: '5',
    xpReward: 300,
    goldReward: 50,
  },
  {
    slug: 'slayer',
    name: 'Сокрушитель',
    description: 'Одержать 10 побед.',
    icon: '⚔️',
    conditionType: 'victories_total',
    conditionValue: '10',
    xpReward: 500,
    goldReward: 100,
  },
  {
    slug: 'boss-hunter',
    name: 'Охотник на боссов',
    description: 'Победить 3 разных боссов.',
    icon: '🐉',
    conditionType: 'bosses_unique',
    conditionValue: '3',
    xpReward: 400,
    goldReward: 80,
  },
  {
    slug: 'clean-code',
    name: 'Чистый код',
    description: 'Пройти статический анализ без ошибок ESLint.',
    icon: '✨',
    conditionType: 'clean_eslint',
    conditionValue: null,
    xpReward: 200,
    goldReward: 40,
  },
  {
    slug: 'perfect-run',
    name: 'Идеальный заход',
    description: 'Победить босса с 100% урона.',
    icon: '💯',
    conditionType: 'perfect_victory',
    conditionValue: null,
    xpReward: 500,
    goldReward: 100,
  },
  {
    slug: 'first-quest',
    name: 'Первый шаг',
    description: 'Сдать первый квест.',
    icon: '👣',
    conditionType: 'submissions_total',
    conditionValue: '1',
    xpReward: 50,
    goldReward: 5,
  },
];

/**
 * Достаёт код ошибки PostgreSQL из вложенного Drizzle/Neon исключения.
 * 23505 — unique_violation.
 */
function getPgCode(e: unknown): string | undefined {
  const anyE = e as {
    cause?: { code?: string; cause?: { code?: string } };
    code?: string;
  };
  return anyE?.cause?.code ?? anyE?.cause?.cause?.code ?? anyE?.code;
}

/**
 * Повторяет операцию до `attempts` раз с задержкой при сетевых ошибках.
 * Ошибки duplicate key (23505) пробрасывает сразу — их ретраить бессмысленно.
 */
async function withRetry<T>(
  name: string,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;

      const code = getPgCode(e);
      if (code === '23505') {
        // duplicate key — не наша проблема, но и не повод падать на уровне retry
        throw e;
      }

      const isNetwork =
        (e as Error)?.message?.includes('fetch failed') ||
        (e as Error)?.message?.includes('Error connecting to database');

      console.warn(
        `⚠ ${name}: попытка ${i}/${attempts}${isNetwork ? ' (сеть)' : ''}`,
      );

      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 800 * i));
      }
    }
  }
  throw lastErr;
}

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // ---------- Очистка ----------

  console.log('→ Очистка таблиц...');

  const safeDelete = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await withRetry(name, fn);
    } catch (e) {
      console.warn(`⚠ ${name}: пропущено (${(e as Error).message})`);
    }
  };

  await safeDelete('delete hero_achievements', () => db.delete(heroAchievements));
  await safeDelete('delete artifacts', () => db.delete(artifacts));
  await safeDelete('delete boss_phases', () => db.delete(bossPhases));
  await safeDelete('delete achievements', () => db.delete(achievements));

  await withRetry('delete quests', () => db.delete(quests));

  // ---------- Квесты ----------

  console.log('→ Загружаем квесты...');

  for (const q of QUESTS) {
    const [quest] = await withRetry(`insert quest ${q.slug}`, () =>
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
        })
        .returning(),
    );

    await withRetry(`insert phases for ${q.slug}`, () =>
      db.insert(bossPhases).values(
        q.phases.map((p) => ({
          questId: quest.id,
          phaseOrder: p.phaseOrder,
          name: p.name,
          description: p.description,
          checkType: p.checkType,
          maxHp: p.maxHp,
        })),
      ),
    );

    await withRetry(`insert artifact for ${q.slug}`, () =>
      db
        .insert(artifacts)
        .values({
          slug: q.artifact.slug,
          name: q.artifact.name,
          description: q.artifact.description,
          icon: q.artifact.icon,
          rarity: q.artifact.rarity,
          questId: quest.id,
        })
        .onConflictDoNothing(),
    );

    console.log(
      `   ✅ ${q.slug}: id=${quest.id}, phases=${q.phases.length}, +artifact ${q.artifact.slug}`,
    );
  }

  // ---------- Достижения ----------

  console.log('→ Загружаем достижения...');

  for (const a of ACHIEVEMENTS) {
    try {
      await withRetry(`insert achievement ${a.slug}`, () =>
        db.insert(achievements).values(a).onConflictDoNothing(),
      );
      console.log(`   ✅ ${a.slug}`);
    } catch (e) {
      const code = getPgCode(e);
      if (code === '23505') {
        console.log(`   ↺ ${a.slug} уже существует — пропускаем`);
      } else {
        throw e;
      }
    }
  }

  // ---------- Проверка ----------

  const questCount = await withRetry('count quests', () =>
    db.select().from(quests),
  );
  const phaseCount = await withRetry('count phases', () =>
    db.select().from(bossPhases),
  );
  const artifactCount = await withRetry('count artifacts', () =>
    db.select().from(artifacts),
  );
  const achievementCount = await withRetry('count achievements', () =>
    db.select().from(achievements),
  );

  console.log('\n📊 Итог:');
  console.log(`   Квестов:      ${questCount.length}`);
  console.log(`   Фаз:          ${phaseCount.length}`);
  console.log(`   Артефактов:   ${artifactCount.length}`);
  console.log(`   Достижений:   ${achievementCount.length}`);
  console.log('\n✅ Seed done.');
}

seed().catch((e) => {
  console.error('❌ Ошибка:', e);
  process.exit(1);
});