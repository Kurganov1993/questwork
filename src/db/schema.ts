import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const heroClassEnum = pgEnum('hero_class', [
  'frontend_mage',
  'backend_warrior',
  'devops_paladin',
  'qa_rogue',
  'designer_bard',
  'pm_druid',
]);

export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'in_progress',
  'victory',
  'defeat',
  'error',
]);

export const heroes = pgTable('heroes', {
  id: serial('id').primaryKey(),
  nickname: varchar('nickname', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  heroClass: heroClassEnum('hero_class').notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  gold: integer('gold').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    heroId: integer('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (t) => ({
    heroIdx: index('sessions_hero_idx').on(t.heroId),
  }),
);

export const quests = pgTable('quests', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  title: varchar('title', { length: 128 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 8 }).notNull().default('⚔️'),
  bossName: varchar('boss_name', { length: 128 }).notNull(),
  bossMaxHp: integer('boss_max_hp').notNull().default(100),
  difficulty: integer('difficulty').notNull().default(1),
  rewardXp: integer('reward_xp').notNull().default(100),
  rewardGold: integer('reward_gold').notNull().default(10),
  victoryThreshold: integer('victory_threshold').notNull().default(85),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bossPhases = pgTable('boss_phases', {
  id: serial('id').primaryKey(),
  questId: integer('quest_id')
    .notNull()
    .references(() => quests.id, { onDelete: 'cascade' }),
  phaseOrder: integer('phase_order').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').notNull(),
  checkType: varchar('check_type', { length: 64 }).notNull().default('skip'),
  maxHp: integer('max_hp').notNull(),
});

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
  report: jsonb('report'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});