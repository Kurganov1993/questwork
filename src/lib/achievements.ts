import { db } from '@/db';
import {
  achievements,
  heroAchievements,
  submissions,
  heroes,
  quests,
} from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { withRetry } from './db-retry';
import type { EarnedAchievementItem } from './types';

type CheckContext = {
  heroId: number;
  currentVictory: boolean;
  currentPerfect: boolean;
  currentCleanEslint: boolean;
  currentQuestId: number;
  currentQuestSlug: string;
};

export async function checkAndAwardAchievements(
  ctx: CheckContext,
): Promise<EarnedAchievementItem[]> {
  const all = await withRetry(() => db.select().from(achievements), {
    label: 'ach:select-all',
  });

  const earned = await withRetry(
    () =>
      db
        .select({ achievementId: heroAchievements.achievementId })
        .from(heroAchievements)
        .where(eq(heroAchievements.heroId, ctx.heroId)),
    { label: 'ach:select-earned' },
  );

  const earnedSet = new Set(earned.map((e) => e.achievementId));

  const [victoriesRow] = await withRetry(
    () =>
      db
        .select({ victories: sql<number>`count(*)::int` })
        .from(submissions)
        .where(
          and(
            eq(submissions.heroId, ctx.heroId),
            eq(submissions.status, 'victory'),
          ),
        ),
    { label: 'ach:count-victories' },
  );
  const victories = Number(victoriesRow?.victories ?? 0);

  const uniqueBosses = await withRetry(
    () =>
      db
        .select({ questId: submissions.questId })
        .from(submissions)
        .where(
          and(
            eq(submissions.heroId, ctx.heroId),
            eq(submissions.status, 'victory'),
          ),
        )
        .groupBy(submissions.questId),
    { label: 'ach:unique-bosses' },
  );

  const [totalSubsRow] = await withRetry(
    () =>
      db
        .select({ totalSubs: sql<number>`count(*)::int` })
        .from(submissions)
        .where(eq(submissions.heroId, ctx.heroId)),
    { label: 'ach:count-subs' },
  );
  const totalSubs = Number(totalSubsRow?.totalSubs ?? 0);

  // Список slug'ов квестов, где герой победил
  const defeatedQuestSlugs = new Set<string>();
  const systemQuestSlugs = new Set<string>();

  try {
    const defeated = await withRetry(
      () =>
        db
          .select({ slug: quests.slug })
          .from(submissions)
          .innerJoin(quests, eq(quests.id, submissions.questId))
          .where(
            and(
              eq(submissions.heroId, ctx.heroId),
              eq(submissions.status, 'victory'),
            ),
          )
          .groupBy(quests.slug),
      { label: 'ach:defeated-slugs' },
    );
    for (const d of defeated) defeatedQuestSlugs.add(d.slug);

    const systemQuests = await withRetry(
      () =>
        db
          .select({ slug: quests.slug })
          .from(quests)
          .where(
            and(
              eq(quests.status, 'active'),
              sql`${quests.customerId} IS NULL`,
            ),
          ),
      { label: 'ach:system-quests' },
    );
    for (const q of systemQuests) systemQuestSlugs.add(q.slug);
  } catch (e) {
    console.error('[achievements] slug fetch failed:', (e as Error).message);
  }

  const newlyEarned: EarnedAchievementItem[] = [];

  for (const a of all) {
    if (earnedSet.has(a.id)) continue;

    let unlocked = false;
    const value = a.conditionValue ? Number(a.conditionValue) : 0;

    switch (a.conditionType) {
      case 'victories_total':
        unlocked = victories >= value;
        break;

      case 'bosses_unique':
        unlocked = uniqueBosses.length >= value;
        break;

      case 'clean_eslint':
        unlocked = ctx.currentCleanEslint && ctx.currentVictory;
        break;

      case 'perfect_victory':
        unlocked = ctx.currentPerfect && ctx.currentVictory;
        break;

      case 'submissions_total':
        unlocked = totalSubs >= value;
        break;

      case 'defeat_boss_with_slug':
        unlocked =
          ctx.currentVictory &&
          !!a.conditionValue &&
          defeatedQuestSlugs.has(a.conditionValue);
        break;

      case 'all_system_bosses': {
        if (systemQuestSlugs.size === 0) {
          unlocked = false;
          break;
        }
        let allDefeated = true;
        for (const slug of systemQuestSlugs) {
          if (!defeatedQuestSlugs.has(slug)) {
            allDefeated = false;
            break;
          }
        }
        unlocked = allDefeated;
        break;
      }
    }

    if (!unlocked) continue;

    await withRetry(
      () =>
        db
          .insert(heroAchievements)
          .values({ heroId: ctx.heroId, achievementId: a.id })
          .onConflictDoNothing(),
      { label: 'ach:insert' },
    );

    newlyEarned.push({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      goldReward: a.goldReward,
    });
  }

  if (newlyEarned.length > 0) {
    const totalXp = newlyEarned.reduce((s, a) => s + a.xpReward, 0);
    const totalGold = newlyEarned.reduce((s, a) => s + a.goldReward, 0);

    await withRetry(
      () =>
        db
          .update(heroes)
          .set({
            xp: sql`${heroes.xp} + ${totalXp}`,
            gold: sql`${heroes.gold} + ${totalGold}`,
          })
          .where(eq(heroes.id, ctx.heroId)),
      { label: 'ach:grant-rewards' },
    );
  }

  return newlyEarned;
}