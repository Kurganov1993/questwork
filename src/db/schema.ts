import {
  pgTable, pgEnum, serial, varchar, text, integer,
  timestamp, jsonb,
} from 'drizzle-orm/pg-core';

// Классы героев
export const heroClassEnum = pgEnum('hero_class', [
  'frontend_mage',   // Frontend
  'backend_warrior', // Backend
  'devops_paladin',  // DevOps
  'qa_rogue',        // QA
  'designer_bard',   // Дизайнер
  'pm_druid',        // PM
]);

// Статус сдачи квеста
export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'in_progress',
  'victory',
  'defeat',
  'error',
]);

// Герои (игроки)
export const heroes = pgTable('heroes', {
  id: serial('id').primaryKey(),
  nickname: varchar('nickname', { length: 64 }).notNull().unique(),
  heroClass: heroClassEnum('hero_class').notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  gold: integer('gold').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Квесты
export const quests = pgTable('quests', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  title: varchar('title', { length: 128 }).notNull(),
  description: text('description').notNull(),
  bossName: varchar('boss_name', { length: 128 }).notNull(),
  bossMaxHp: integer('boss_max_hp').notNull().default(100),
  difficulty: integer('difficulty').notNull().default(1),
  rewardXp: integer('reward_xp').notNull().default(100),
  rewardGold: integer('reward_gold').notNull().default(10),
  victoryThreshold: integer('victory_threshold').notNull().default(85),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Фазы босса (урон по фазам)
export const bossPhases = pgTable('boss_phases', {
  id: serial('id').primaryKey(),
  questId: integer('quest_id')
    .notNull()
    .references(() => quests.id, { onDelete: 'cascade' }),
  // Переименовали order → phaseOrder, чтобы не конфликтовать
  // с зарезервированным словом PostgreSQL.
  phaseOrder: integer('phase_order').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').notNull(),
  maxHp: integer('max_hp').notNull(),
});

// Сдачи (репозитории игроков на проверку)
export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  heroId: integer('hero_id')
    .notNull()
    .references(() => heroes.id, { onDelete: 'cascade' }),
  questId: integer('quest_id')
    .notNull()
    .references(() => quests.id, { onDelete: 'cascade' }),
  repoUrl: varchar('repo_url', { length: 512 }).notNull(),
  status: submissionStatusEnum('status').notNull().default('pending'),
  damageDealt: integer('damage_dealt').notNull().default(0),
  report: jsonb('report'), // детальный отчёт проверки
  createdAt: timestamp('created_at').notNull().defaultNow(),
});