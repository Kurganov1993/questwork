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
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================================
// ENUM'ы
// ============================================================

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

export const rarityEnum = pgEnum('rarity', [
  'common',
  'rare',
  'epic',
  'legendary',
]);

export const questStatusEnum = pgEnum('quest_status', [
  'draft',
  'active',
  'archived',
]);

// ============================================================
// Герои
// ============================================================

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

// ============================================================
// Работодатели (компании-заказчики)
// ============================================================

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const customerSessions = pgTable(
  'customer_sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (t) => ({
    customerIdx: index('customer_sessions_customer_idx').on(t.customerId),
  }),
);

// ============================================================
// Квесты
// ============================================================

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
  customerId: integer('customer_id').references(() => customers.id, {
    onDelete: 'cascade',
  }),
  status: questStatusEnum('status').notNull().default('active'),
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

// ============================================================
// Сдачи
// ============================================================

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
  employerStatus: varchar('employer_status', { length: 32 }),
  employerNote: text('employer_note'),
  employerStatusAt: timestamp('employer_status_at'),
  heroSeenAt: timestamp('hero_seen_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// Артефакты (лут)
// ============================================================

export const artifacts = pgTable('artifacts', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 8 }).notNull().default('💎'),
  rarity: rarityEnum('rarity').notNull().default('common'),
  questId: integer('quest_id')
    .notNull()
    .references(() => quests.id, { onDelete: 'cascade' }),
});

export const heroArtifacts = pgTable(
  'hero_artifacts',
  {
    id: serial('id').primaryKey(),
    heroId: integer('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    artifactId: integer('artifact_id')
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqHeroArtifact: uniqueIndex('hero_artifact_unique').on(
      t.heroId,
      t.artifactId,
    ),
  }),
);

// ============================================================
// Достижения
// ============================================================

export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 8 }).notNull().default('🏆'),
  conditionType: varchar('condition_type', { length: 64 }).notNull(),
  conditionValue: varchar('condition_value', { length: 128 }),
  xpReward: integer('xp_reward').notNull().default(0),
  goldReward: integer('gold_reward').notNull().default(0),
});

export const heroAchievements = pgTable(
  'hero_achievements',
  {
    id: serial('id').primaryKey(),
    heroId: integer('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    achievementId: integer('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqHeroAchievement: uniqueIndex('hero_achievement_unique').on(
      t.heroId,
      t.achievementId,
    ),
  }),
);

export const githubAccounts = pgTable('github_accounts', {
  id: serial('id').primaryKey(),
  heroId: integer('hero_id')
    .notNull()
    .unique()
    .references(() => heroes.id, { onDelete: 'cascade' }),
  githubId: varchar('github_id', { length: 64 }).notNull(),
  githubUsername: varchar('github_username', { length: 128 }).notNull(),
  accessToken: text('access_token').notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rateLimits = pgTable(
  'rate_limits',
  {
    id: serial('id').primaryKey(),
    bucket: varchar('bucket', { length: 128 }).notNull(),
    key: varchar('key', { length: 128 }).notNull(),
    count: integer('count').notNull().default(1),
    windowStart: timestamp('window_start').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqBucketKey: uniqueIndex('rate_limits_bucket_key_unique').on(
      t.bucket,
      t.key,
    ),
  }),
);

// ============================================================
// Типы
// ============================================================

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type QuestStatus = 'draft' | 'active' | 'archived';