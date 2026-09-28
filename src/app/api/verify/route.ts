import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { quests, bossPhases, submissions, heroes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { runVerification } from '@/lib/verifier';
import { getCurrentHero } from '@/lib/auth';
import { awardQuestArtifacts } from '@/lib/loot';
import { checkAndAwardAchievements } from '@/lib/achievements';
import { withRetry } from '@/lib/db-retry';
import type { VerifyResponse, VerifyReport } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const hero = await getCurrentHero();
    if (!hero) {
      return NextResponse.json<VerifyResponse>(
        { ok: false, error: 'Нужно войти в аккаунт героя' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { repoUrl, questSlug } = body as {
      repoUrl?: string;
      questSlug?: string;
    };

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json<VerifyResponse>(
        { ok: false, error: 'repoUrl обязателен' },
        { status: 400 },
      );
    }

    const [quest] = await withRetry(
      () =>
        db
          .select()
          .from(quests)
          .where(eq(quests.slug, questSlug ?? 'create-shop')),
      { label: 'verify:get-quest' },
    );

    if (!quest) {
      return NextResponse.json<VerifyResponse>(
        { ok: false, error: 'Квест не найден' },
        { status: 404 },
      );
    }

    const phases = await withRetry(
      () =>
        db
          .select({
            phaseOrder: bossPhases.phaseOrder,
            name: bossPhases.name,
            description: bossPhases.description,
            checkType: bossPhases.checkType,
            maxHp: bossPhases.maxHp,
          })
          .from(bossPhases)
          .where(eq(bossPhases.questId, quest.id)),
      { label: 'verify:get-phases' },
    );

    console.log('[api/verify] hero:', {
      id: hero.id,
      nickname: hero.nickname,
    });

    const report = await runVerification(
      repoUrl,
      phases,
      quest.victoryThreshold,
    );

    console.log('[api/verify] result:', {
      totalDamage: report.totalDamage,
      bossMaxHp: report.bossMaxHp,
      victory: report.victory,
    });

    const [submission] = await withRetry(
      () =>
        db
          .insert(submissions)
          .values({
            heroId: hero.id,
            questId: quest.id,
            repoUrl,
            status: report.victory ? 'victory' : 'defeat',
            damageDealt: report.totalDamage,
            report,
          })
          .returning(),
      { label: 'verify:insert-submission' },
    );

    // ============================================================
    // Награды за победу — обёрнуты в try/catch (не роняют ответ)
    // ============================================================
    if (report.victory) {
      try {
        await grantRewards(hero.id, quest.id, quest, report, submission.id);
      } catch (e) {
        console.error('[api/verify] reward block failed (non-fatal):', e);
      }
    }

    // ============================================================
    // Достижения — тоже не роняют ответ
    // ============================================================
    try {
      const perfect = report.totalDamage === report.bossMaxHp;

      const staticPhase = report.phases.find(
        (p) => p.name === 'Статический анализ',
      );

      const cleanEslint =
        !!staticPhase &&
        staticPhase.passed &&
        (staticPhase.details?.metrics?.eslintErrors ?? 0) === 0;

      const achievements = await checkAndAwardAchievements({
        heroId: hero.id,
        currentVictory: report.victory,
        currentPerfect: perfect,
        currentCleanEslint: cleanEslint,
        currentQuestId: quest.id,
      });

      console.log('[api/verify] achievements check:', {
        perfect,
        cleanEslint,
        victory: report.victory,
        found: achievements.length,
        slugs: achievements.map((a) => a.slug),
      });

      if (achievements.length > 0) {
        report.achievementsGained = achievements;
        report.achievementXp = achievements.reduce(
          (s, a) => s + a.xpReward,
          0,
        );
        report.achievementGold = achievements.reduce(
          (s, a) => s + a.goldReward,
          0,
        );
      }
    } catch (e) {
      console.error('[api/verify] achievements failed (non-fatal):', e);
    }

    return NextResponse.json<VerifyResponse>({
      ok: true,
      submissionId: submission.id,
      report,
    });
  } catch (e) {
    console.error('[api/verify] error:', e);
    return NextResponse.json<VerifyResponse>(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}

async function grantRewards(
  heroId: number,
  questId: number,
  quest: typeof quests.$inferSelect,
  report: VerifyReport,
  currentSubmissionId: number,
) {
  const priorVictories = await withRetry(
    () =>
      db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.heroId, heroId),
            eq(submissions.questId, questId),
            eq(submissions.status, 'victory'),
          ),
        ),
    { label: 'reward:prior-victories' },
  );

  const priorWithoutCurrent = priorVictories.filter(
    (s) => s.id !== currentSubmissionId,
  ).length;

  const repeated = priorWithoutCurrent > 0;

  const xpGain = repeated ? Math.floor(quest.rewardXp * 0.2) : quest.rewardXp;
  const goldGain = repeated
    ? Math.floor(quest.rewardGold * 0.2)
    : quest.rewardGold;
  const levelGain = repeated ? 0 : 1;

  await withRetry(
    () =>
      db
        .update(heroes)
        .set({
          xp: sql`${heroes.xp} + ${xpGain}`,
          gold: sql`${heroes.gold} + ${goldGain}`,
          level: sql`${heroes.level} + ${levelGain}`,
        })
        .where(eq(heroes.id, heroId)),
    { label: 'reward:hero-update' },
  );

  const loot = await awardQuestArtifacts(heroId, questId);
  report.loot = loot;
  report.xpGained = xpGain;
  report.goldGained = goldGain;
}