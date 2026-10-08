import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { quests, bossPhases } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { CHECK_TYPES } from '@/lib/check-types';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

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
  status?: 'draft' | 'active' | 'archived';
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json(
        { ok: false, error: 'Нужно войти как работодатель' },
        { status: 401 },
      );
    }

    const rl = await checkRateLimit(
      'submissionStatus',
      `customer:${customer.id}`,
    );
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id } = await params;
    const questId = Number(id);
    if (!Number.isFinite(questId)) {
      return NextResponse.json(
        { ok: false, error: 'Неверный id' },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select()
      .from(quests)
      .where(and(eq(quests.id, questId), eq(quests.customerId, customer.id)));

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Квест не найден' },
        { status: 404 },
      );
    }

    const body = (await req.json()) as Body;
    const update: Partial<typeof quests.$inferInsert> = {};

    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (t.length < 3 || t.length > 128) {
        return NextResponse.json(
          { ok: false, error: 'Название 3–128 символов' },
          { status: 400 },
        );
      }
      update.title = t;
    }

    if (typeof body.description === 'string') {
      const d = body.description.trim();
      if (d.length < 10 || d.length > 5000) {
        return NextResponse.json(
          { ok: false, error: 'Описание 10–5000 символов' },
          { status: 400 },
        );
      }
      update.description = d;
    }

    if (typeof body.icon === 'string') {
      update.icon = body.icon.trim().slice(0, 8) || '⚔️';
    }

    if (typeof body.bossName === 'string') {
      const b = body.bossName.trim();
      if (b.length < 2 || b.length > 128) {
        return NextResponse.json(
          { ok: false, error: 'Имя босса 2–128 символов' },
          { status: 400 },
        );
      }
      update.bossName = b;
    }

    if (typeof body.difficulty === 'number') {
      update.difficulty = Math.max(1, Math.min(5, body.difficulty));
    }

    if (typeof body.rewardXp === 'number') {
      update.rewardXp = Math.max(0, Math.floor(body.rewardXp));
    }

    if (typeof body.rewardGold === 'number') {
      update.rewardGold = Math.max(0, Math.floor(body.rewardGold));
    }

    if (typeof body.victoryThreshold === 'number') {
      update.victoryThreshold = Math.max(
        10,
        Math.min(100, body.victoryThreshold),
      );
    }

    if (
      body.status === 'draft' ||
      body.status === 'active' ||
      body.status === 'archived'
    ) {
      update.status = body.status;
      if (body.status === 'active' && existing.status !== 'active') {
        update.publishedAt = new Date();
      }
    }

    if (Array.isArray(body.phases)) {
      if (body.phases.length < 1 || body.phases.length > 12) {
        return NextResponse.json(
          { ok: false, error: 'Фаз должно быть от 1 до 12' },
          { status: 400 },
        );
      }

      const validCheckTypes = new Set(CHECK_TYPES.map((c) => c.value));
      for (const p of body.phases) {
        if (!p.name || p.name.trim().length < 2 || p.name.trim().length > 128) {
          return NextResponse.json(
            { ok: false, error: 'Название фазы 2–128 символов' },
            { status: 400 },
          );
        }
        if ((p.description ?? '').trim().length > 1000) {
          return NextResponse.json(
            { ok: false, error: 'Описание фазы максимум 1000 символов' },
            { status: 400 },
          );
        }
        if (!validCheckTypes.has(p.checkType)) {
          return NextResponse.json(
            { ok: false, error: `Неизвестный тип: ${p.checkType}` },
            { status: 400 },
          );
        }
        if (!Number.isFinite(p.maxHp) || p.maxHp <= 0 || p.maxHp > 500) {
          return NextResponse.json(
            { ok: false, error: 'maxHp должен быть 1–500' },
            { status: 400 },
          );
        }
      }

      update.bossMaxHp = body.phases.reduce(
        (s, p) => s + Number(p.maxHp),
        0,
      );

      await db.delete(bossPhases).where(eq(bossPhases.questId, questId));
      await db.insert(bossPhases).values(
        body.phases.map((p, i) => ({
          questId,
          phaseOrder: i + 1,
          name: p.name.trim(),
          description: p.description?.trim() || '—',
          checkType: p.checkType,
          maxHp: Number(p.maxHp),
        })),
      );
    }

    if (Object.keys(update).length > 0) {
      await db.update(quests).set(update).where(eq(quests.id, questId));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('employer/quests:PATCH', {
      message: (e as Error).message,
    });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json(
        { ok: false, error: 'Нужно войти как работодатель' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const questId = Number(id);

    const [existing] = await db
      .select({ id: quests.id })
      .from(quests)
      .where(and(eq(quests.id, questId), eq(quests.customerId, customer.id)));

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Квест не найден' },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') ?? 'archive';

    if (mode === 'delete') {
      await db.delete(quests).where(eq(quests.id, questId));
      logger.info('employer.quest.deleted', {
        customerId: customer.id,
        questId,
      });
    } else {
      await db
        .update(quests)
        .set({ status: 'archived' })
        .where(eq(quests.id, questId));
      logger.info('employer.quest.archived', {
        customerId: customer.id,
        questId,
      });
    }

    return NextResponse.json({ ok: true, mode });
  } catch (e) {
    logger.error('employer/quests:DELETE', {
      message: (e as Error).message,
    });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}