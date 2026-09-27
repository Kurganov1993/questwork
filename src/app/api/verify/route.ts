import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { quests, bossPhases, submissions, heroes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { runVerification } from '@/lib/verifier';
import { getCurrentHero } from '@/lib/auth';
import { awardQuestArtifacts } from '@/lib/loot';
import type { VerifyResponse } from '@/lib/types';

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

    const [quest] = await db
      .select()
      .from(quests)
      .where(eq(quests.slug, questSlug ?? 'create-shop'));

    if (!quest) {
      return NextResponse.json<VerifyResponse>(
        { ok: false, error: 'Квест не найден' },
        { status: 404 },
      );
    }

    const phases = await db
      .select({
        phaseOrder: bossPhases.phaseOrder,
        name: bossPhases.name,
        description: bossPhases.description,
        checkType: bossPhases.checkType,
        maxHp: bossPhases.maxHp,
      })
      .from(bossPhases)
      .where(eq(bossPhases.questId, quest.id));

    console.log('[api/verify] hero:', { id: hero.id, nickname: hero.nickname });
    console.log('[api/verify] quest:', {
      slug: quest.slug,
      victoryThreshold: quest.victoryThreshold,
      phases: phases.length,
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

    const [submission] = await db
      .insert(submissions)
      .values({
        heroId: hero.id,
        questId: quest.id,
        repoUrl,
        status: report.victory ? 'victory' : 'defeat',
        damageDealt: report.totalDamage,
        report,
      })
      .returning();

    if (report.victory) {
      const [fresh] = await db
        .select({ xp: heroes.xp, gold: heroes.gold, level: heroes.level })
        .from(heroes)
        .where(eq(heroes.id, hero.id));

      // Есть ли уже победа над этим квестом (не считая текущей сдачи)
      const priorVictories = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.heroId, hero.id),
            eq(submissions.questId, quest.id),
            eq(submissions.status, 'victory'),
          ),
        );

      const repeated = priorVictories.length > 1;

      const xpGain = repeated
        ? Math.floor(quest.rewardXp * 0.2)
        : quest.rewardXp;
      const goldGain = repeated
        ? Math.floor(quest.rewardGold * 0.2)
        : quest.rewardGold;
      const levelGain = repeated ? 0 : 1;

      await db
        .update(heroes)
        .set({
          xp: fresh.xp + xpGain,
          gold: fresh.gold + goldGain,
          level: fresh.level + levelGain,
        })
        .where(eq(heroes.id, hero.id));

      const loot = await awardQuestArtifacts(hero.id, quest.id);
      report.loot = loot;
      report.xpGained = xpGain;
      report.goldGained = goldGain;
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