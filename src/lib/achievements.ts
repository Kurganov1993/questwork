import { db } from '@/db';
import {
  achievements,
  heroAchievements,
  submissions,
  heroes,
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
};

export async function checkAndAwardAchievements(
  ctx: CheckContext,
): Promise<EarnedAchievementItem[]> {
  const all = await withRetry(
    () => db.select().from(achievements),
    { label: 'ach:select-all' },
  );

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