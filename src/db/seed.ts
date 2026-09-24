import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { quests, bossPhases } from './schema';
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
  phases: PhaseSeed[];
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
    phases: [
      { phaseOrder: 1, name: 'Репозиторий открыт', description: 'GitHub-репозиторий доступен по ссылке.', checkType: 'repo_exists', maxHp: 10 },
      { phaseOrder: 2, name: 'README и структура', description: 'Есть README, осмысленные коммиты.', checkType: 'readme', maxHp: 10 },
      { phaseOrder: 3, name: 'Сборка проекта', description: 'Есть package.json и скрипт build.', checkType: 'build_config', maxHp: 15 },
      { phaseOrder: 4, name: 'Статический анализ', description: 'ESLint и Semgrep: стиль, уязвимости, секреты.', checkType: 'static_analysis', maxHp: 10 },
      { phaseOrder: 5, name: 'Тесты проходят', description: 'Есть конфигурация тестов и тестовые файлы.', checkType: 'tests', maxHp: 15 },
      { phaseOrder: 6, name: 'Деплой живой', description: 'Ссылка на задеплоенное приложение работает.', checkType: 'deploy', maxHp: 20 },
      { phaseOrder: 7, name: 'E2E-сценарий', description: 'Настроены end-to-end тесты (Playwright/Cypress).', checkType: 'e2e', maxHp: 15 },
      { phaseOrder: 8, name: 'Безопасность', description: 'Нет секретов, есть .gitignore.', checkType: 'secrets', maxHp: 10 },
      { phaseOrder: 9, name: 'Ревью наставника', description: 'Качество архитектуры и читаемость (эвристика).', checkType: 'review', maxHp: 5 },
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

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  await db.delete(bossPhases);
  await db.delete(quests);

  for (const q of QUESTS) {
    const [quest] = await db
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
      .returning();

    await db.insert(bossPhases).values(
      q.phases.map((p) => ({
        questId: quest.id,
        phaseOrder: p.phaseOrder,
        name: p.name,
        description: p.description,
        checkType: p.checkType,
        maxHp: p.maxHp,
      })),
    );

    console.log(`✅ ${q.slug}: quest id=${quest.id}, phases=${q.phases.length}`);
  }

  console.log('✅ Seed done.');
}

seed().catch(console.error);