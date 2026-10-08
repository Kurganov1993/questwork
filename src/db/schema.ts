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
  numeric,
  bigserial,
  boolean,
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

export const cataDifficultyEnum = pgEnum('cata_difficulty', [
  'easy',
  'medium',
  'hard',
]);

// ============================================================
// Герои
// ============================================================

export const heroes = pgTable(
  'heroes',
  {
    id: serial('id').primaryKey(),
    nickname: varchar('nickname', { length: 64 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    heroClass: heroClassEnum('hero_class').notNull(),
    level: integer('level').notNull().default(1),
    xp: integer('xp').notNull().default(0),
    gold: integer('gold').notNull().default(0),
    email: varchar('email', { length: 255 }),
    emailVerifiedAt: timestamp('email_verified_at'),
    notifyByEmail: boolean('notify_by_email').notNull().default(true),
    termsAcceptedAt: timestamp('terms_accepted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    xpIdx: index('heroes_xp_idx').on(t.xp),
    levelIdx: index('heroes_level_idx').on(t.level),
  }),
);

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
// Работодатели
// ============================================================

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  termsAcceptedAt: timestamp('terms_accepted_at'),
  emailVerifiedAt: timestamp('email_verified_at'),
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

export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 64 }).notNull().unique(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('email_verif_customer_idx').on(t.customerId),
    expiresIdx: index('email_verifications_expires_idx').on(t.expiresAt),
  }),
);

export const passwordResets = pgTable(
  'password_resets',
  {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 64 }).notNull().unique(),
    heroId: integer('hero_id').references(() => heroes.id, {
      onDelete: 'cascade',
    }),
    customerId: integer('customer_id').references(() => customers.id, {
      onDelete: 'cascade',
    }),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: index('password_resets_token_idx').on(t.token),
    expiresIdx: index('password_resets_expires_idx').on(t.expiresAt),
  }),
);

export const pageViews = pgTable(
  'page_views',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    path: varchar('path', { length: 512 }).notNull(),
    referrer: varchar('referrer', { length: 512 }),
    userAgent: text('user_agent'),
    ipHash: varchar('ip_hash', { length: 64 }),
    heroId: integer('hero_id').references(() => heroes.id, {
      onDelete: 'set null',
    }),
    sessionId: varchar('session_id', { length: 64 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index('page_views_created_idx').on(t.createdAt),
    pathIdx: index('page_views_path_idx').on(t.path),
    ipIdx: index('page_views_ip_idx').on(t.ipHash),
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
  publishedAt: timestamp('published_at'),
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

export const submissions = pgTable(
  'submissions',
  {
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
  },
  (t) => ({
    heroQuestIdx: index('submissions_hero_quest_idx').on(t.heroId, t.questId),
    questStatusIdx: index('submissions_quest_status_idx').on(
      t.questId,
      t.status,
    ),
    createdIdx: index('submissions_created_idx').on(t.createdAt),
  }),
);

// ============================================================
// Артефакты
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

// ============================================================
// GitHub OAuth
// ============================================================

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

// ============================================================
// Rate limits
// ============================================================

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
// AI usage и кэш
// ============================================================

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: serial('id').primaryKey(),
    heroId: integer('hero_id').references(() => heroes.id, {
      onDelete: 'set null',
    }),
    questId: integer('quest_id').references(() => quests.id, {
      onDelete: 'set null',
    }),
    provider: varchar('provider', { length: 64 }).notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    durationMs: integer('duration_ms').notNull().default(0),
    status: varchar('status', { length: 32 }).notNull().default('ok'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    heroIdx: index('ai_usage_hero_idx').on(t.heroId),
    createdIdx: index('ai_usage_created_idx').on(t.createdAt),
  }),
);

export const aiReviewCache = pgTable(
  'ai_review_cache',
  {
    id: serial('id').primaryKey(),
    cacheKey: varchar('cache_key', { length: 256 }).notNull().unique(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index('ai_review_cache_created_idx').on(t.createdAt),
  }),
);

// ============================================================
// Каты
// ============================================================

export const catas = pgTable('catas', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  title: varchar('title', { length: 128 }).notNull(),
  description: text('description').notNull(),
  difficulty: cataDifficultyEnum('difficulty').notNull().default('easy'),
  language: varchar('language', { length: 32 }).notNull().default('javascript'),
  starterCode: text('starter_code').notNull(),
  testCode: text('test_code').notNull(),
  hint: text('hint'),
  xpReward: integer('xp_reward').notNull().default(50),
  goldReward: integer('gold_reward').notNull().default(5),
  timeLimitSec: integer('time_limit_sec').notNull().default(10),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const cataSubmissions = pgTable('cata_submissions', {
  id: serial('id').primaryKey(),
  cataId: integer('cata_id')
    .notNull()
    .references(() => catas.id, { onDelete: 'cascade' }),
  heroId: integer('hero_id')
    .notNull()
    .references(() => heroes.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  passed: integer('passed').notNull().default(0),
  total: integer('total').notNull().default(0),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  output: text('output'),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================
// Типы
// ============================================================

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type QuestStatus = 'draft' | 'active' | 'archived';
export type CataDifficulty = 'easy' | 'medium' | 'hard';