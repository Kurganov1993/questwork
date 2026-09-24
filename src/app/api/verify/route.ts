import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { quests, submissions, heroes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { runVerification } from '@/lib/verifier';
import { getCurrentHero } from '@/lib/auth';
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

    console.log('[api/verify] hero:', { id: hero.id, nickname: hero.nickname });
    console.log('[api/verify] quest:', {
      slug: quest.slug,
      victoryThreshold: quest.victoryThreshold,
      bossMaxHp: quest.bossMaxHp,
    });

    const report = await runVerification(repoUrl, quest.victoryThreshold);

    console.log('[api/verify] result:', {
      totalDamage: report.totalDamage,
      bossMaxHp: report.bossMaxHp,
      threshold: quest.victoryThreshold,
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
        .select({
          xp: heroes.xp,
          gold: heroes.gold,
          level: heroes.level,
        })
        .from(heroes)
        .where(eq(heroes.id, hero.id));

      await db
        .update(heroes)
        .set({
          xp: fresh.xp + quest.rewardXp,
          gold: fresh.gold + quest.rewardGold,
          level: fresh.level + 1,
        })
        .where(eq(heroes.id, hero.id));
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