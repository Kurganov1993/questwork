import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { quests, submissions, heroes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { runVerification } from '@/lib/verifier';
import type { VerifyResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoUrl, questSlug } = body as { repoUrl?: string; questSlug?: string };

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json<VerifyResponse>({ ok: false, error: 'repoUrl обязателен' }, { status: 400 });
    }

    const [quest] = await db.select().from(quests).where(eq(quests.slug, questSlug ?? 'create-shop'));
    if (!quest) {
      return NextResponse.json<VerifyResponse>({ ok: false, error: 'Квест не найден' }, { status: 404 });
    }

    // Временно: гостевой герой. Авторизацию добавим позже.
    const guest = await getOrCreateGuestHero();

    // Запускаем проверку
    const report = await runVerification(repoUrl);

    const [submission] = await db
      .insert(submissions)
      .values({
        heroId: guest.id,
        questId: quest.id,
        repoUrl,
        status: report.victory ? 'victory' : 'defeat',
        damageDealt: report.totalDamage,
        report,
      })
      .returning();

    // Если победа — начисляем награды
    if (report.victory) {
      await db
        .update(heroes)
        .set({
          xp: guest.xp + quest.rewardXp,
          gold: guest.gold + quest.rewardGold,
          level: guest.level + 1,
        })
        .where(eq(heroes.id, guest.id));
    }

    return NextResponse.json<VerifyResponse>({
      ok: true,
      submissionId: submission.id,
      report,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json<VerifyResponse>({ ok: false, error: 'Внутренняя ошибка' }, { status: 500 });
  }
}

async function getOrCreateGuestHero() {
  const [existing] = await db.select().from(heroes).where(eq(heroes.nickname, 'guest'));
  if (existing) return existing;
  const [created] = await db
    .insert(heroes)
    .values({ nickname: 'guest', heroClass: 'frontend_mage' })
    .returning();
  return created;
}