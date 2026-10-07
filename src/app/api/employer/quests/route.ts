import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { quests, bossPhases, artifacts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentCustomer, slugify } from '@/lib/customer-auth';
import { CHECK_TYPES } from '@/lib/check-types';
import {
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';

type PhaseInput = {
  name: string;
  description: string;
  checkType: string;
  maxHp: number;
};

type Body = {
  title?: string;
  description?: string;
  icon?: string;
  bossName?: string;
  difficulty?: number;
  rewardXp?: number;
  rewardGold?: number;
  victoryThreshold?: number;
  phases?: PhaseInput[];
};

export async function POST(req: NextRequest) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer)
      return NextResponse.json(
        { ok: false, error: 'Нужно войти как работодатель' },
        { status: 401 },
      );

    const rl = await checkRateLimit(
      'employerCreate',
      `customer:${customer.id}`,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const body = (await req.json()) as Body;

    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const icon = String(body.icon ?? '⚔️').trim().slice(0, 8);
    const bossName = String(body.bossName ?? '').trim();
    const difficulty = Math.max(1, Math.min(5, Number(body.difficulty ?? 1)));
    const rewardXp = Math.max(0, Number(body.rewardXp ?? 100));
    const rewardGold = Math.max(0, Number(body.rewardGold ?? 10));
    const victoryThreshold = Math.max(
      10,
      Math.min(100, Number(body.victoryThreshold ?? 65)),
    );
    const phases = Array.isArray(body.phases) ? body.phases : [];

    if (title.length < 3)
      return NextResponse.json(
        { ok: false, error: 'Название минимум 3 символа' },
        { status: 400 },
      );
    if (description.length < 10)
      return NextResponse.json(
        { ok: false, error: 'Описание минимум 10 символов' },
        { status: 400 },
      );
    if (bossName.length < 2)
      return NextResponse.json(
        { ok: false, error: 'Имя босса минимум 2 символа' },
        { status: 400 },
      );
    if (phases.length < 1 || phases.length > 12)
      return NextResponse.json(
        { ok: false, error: 'Фаз должно быть от 1 до 12' },
        { status: 400 },
      );

    const validCheckTypes = new Set(CHECK_TYPES.map((c) => c.value));
    for (const p of phases) {
      if (!p.name || p.name.trim().length < 2) {
        return NextResponse.json(
          { ok: false, error: 'У каждой фазы должно быть название' },
          { status: 400 },
        );
      }
      if (!validCheckTypes.has(p.checkType)) {
        return NextResponse.json(
          { ok: false, error: `Неизвестный тип проверки: ${p.checkType}` },
          { status: 400 },
        );
      }
      if (!Number.isFinite(p.maxHp) || p.maxHp <= 0) {
        return NextResponse.json(
          { ok: false, error: 'У каждой фазы должен быть maxHp > 0' },
          { status: 400 },
        );
      }
    }

    const bossMaxHp = phases.reduce((s, p) => s + Number(p.maxHp), 0);

    // Уникальный slug
    let slug = slugify(title) || 'quest';
    let attempt = 0;
    while (attempt < 10) {
      const [taken] = await db
        .select({ id: quests.id })
        .from(quests)
        .where(eq(quests.slug, slug));
      if (!taken) break;
      attempt++;
      slug = `${slugify(title) || 'quest'}-${attempt + 1}`;
    }

    const [quest] = await db
      .insert(quests)
      .values({
        slug,
        title,
        description,
        icon,
        bossName,
        bossMaxHp,
        difficulty,
        rewardXp,
        rewardGold,
        victoryThreshold,
        customerId: customer.id,
        status: 'active',
      })
      .returning();

    await db.insert(bossPhases).values(
      phases.map((p, i) => ({
        questId: quest.id,
        phaseOrder: i + 1,
        name: p.name.trim(),
        description: p.description.trim() || '—',
        checkType: p.checkType,
        maxHp: Number(p.maxHp),
      })),
    );

    // Артефакт квеста
    const artifactSlug = `${slug}-artifact`;
    const existingArtifact = await db
      .select({ id: artifacts.id })
      .from(artifacts)
      .where(eq(artifacts.slug, artifactSlug));

    if (existingArtifact.length === 0) {
      await db.insert(artifacts).values({
        slug: artifactSlug,
        name: `Трофей «${title}»`,
        description: `Награда за победу в квесте «${title}».`,
        icon: '🏅',
        rarity: difficulty >= 4 ? 'epic' : difficulty >= 3 ? 'rare' : 'common',
        questId: quest.id,
      });
    }

    return NextResponse.json({ ok: true, questId: quest.id, slug });
  } catch (e) {
    console.error('[employer/quests:create]', e);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}