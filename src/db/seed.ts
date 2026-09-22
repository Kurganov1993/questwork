import { db } from './index';
import { heroes, quests, bossPhases } from './schema';

async function seed() {
  console.log('🌱 Начинаем сидирование...');

  // 1. Герой
  await db.insert(heroes).values({
    nickname: 'test_hero',
    heroClass: 'frontend_mage',
    level: 1,
    xp: 0,
    gold: 0,
  });
  console.log('✅ Герой добавлен');

  // 2. Квест — .returning() обязателен, чтобы получить id
  const [quest] = await db
    .insert(quests)
    .values({
      slug: 'create-shop',
      title: 'Создать интернет-магазин',
      description:
        'Древний Торговец захватил рынок. Постройте витрину, корзину и оформление заказа, чтобы сразить его.',
      bossName: 'Древний Торговец',
      bossMaxHp: 100,
      difficulty: 1,
      rewardXp: 500,
      rewardGold: 30,
    })
    .returning();

  const questId = quest.id;
  console.log(`✅ Квест добавлен, id = ${questId}`);

  // 3. Фазы босса — с обязательным phaseOrder
  await db.insert(bossPhases).values([
    {
      questId,
      phaseOrder: 1,
      name: 'Репозиторий открыт',
      description: 'GitHub-репозиторий доступен по ссылке.',
      maxHp: 10,
    },
    {
      questId,
      phaseOrder: 2,
      name: 'README и структура',
      description: 'Есть README, осмысленные коммиты.',
      maxHp: 10,
    },
    {
      questId,
      phaseOrder: 3,
      name: 'Сборка проекта',
      description: 'Проект собирается без ошибок.',
      maxHp: 15,
    },
    {
      questId,
      phaseOrder: 4,
      name: 'Тесты проходят',
      description: 'Unit-тесты зелёные.',
      maxHp: 15,
    },
    {
      questId,
      phaseOrder: 5,
      name: 'Деплой живой',
      description: 'Ссылка на задеплоенное приложение работает.',
      maxHp: 20,
    },
    {
      questId,
      phaseOrder: 6,
      name: 'E2E-сценарий',
      description: 'Каталог → корзина → оформление заказа.',
      maxHp: 15,
    },
    {
      questId,
      phaseOrder: 7,
      name: 'Безопасность',
      description: 'Нет секретов, зависимости чистые.',
      maxHp: 10,
    },
    {
      questId,
      phaseOrder: 8,
      name: 'Ревью наставника',
      description: 'Архитектура и читаемость.',
      maxHp: 5,
    },
  ]);
  console.log('✅ Фазы босса добавлены');

  console.log('🎉 Сидирование завершено');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Ошибка сидирования:', err);
  process.exit(1);
});