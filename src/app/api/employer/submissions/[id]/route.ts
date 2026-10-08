import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { submissions, quests, customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { EMPLOYER_STATUSES } from '@/lib/employer-constants';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { notifyHeroByEmail } from '@/lib/notifications';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

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
    const subId = Number(id);
    if (!Number.isFinite(subId)) {
      return NextResponse.json(
        { ok: false, error: 'Неверный id' },
        { status: 400 },
      );
    }

    const [row] = await db
      .select({
        id: submissions.id,
        questCustomerId: quests.customerId,
      })
      .from(submissions)
      .innerJoin(quests, eq(quests.id, submissions.questId))
      .where(eq(submissions.id, subId));

    if (!row || row.questCustomerId !== customer.id) {
      return NextResponse.json(
        { ok: false, error: 'Сдача не найдена' },
        { status: 404 },
      );
    }

    const body = (await req.json()) as {
      employerStatus?: string | null;
      employerNote?: string | null;
    };

    const allowed = new Set(EMPLOYER_STATUSES.map((s) => s.value));

    let statusValue: string | null = null;
    if (body.employerStatus === null) {
      statusValue = null;
    } else if (typeof body.employerStatus === 'string') {
      if (!allowed.has(body.employerStatus as never)) {
        return NextResponse.json(
          { ok: false, error: 'Неизвестный статус' },
          { status: 400 },
        );
      }
      statusValue = body.employerStatus;
    }

    const note =
      typeof body.employerNote === 'string'
        ? body.employerNote.slice(0, 1000)
        : undefined;

    await db
      .update(submissions)
      .set({
        employerStatus: statusValue,
        ...(note !== undefined ? { employerNote: note || null } : {}),
        employerStatusAt: new Date(),
      })
      .where(eq(submissions.id, subId));

    // ============================================================
    // Email-уведомление герою (не блокирует ответ)
    // ============================================================
    if (
      statusValue === 'shortlisted' ||
      statusValue === 'interview' ||
      statusValue === 'hired' ||
      statusValue === 'rejected'
    ) {
      try {
        const [submissionInfo] = await db
          .select({
            heroId: submissions.heroId,
            questTitle: quests.title,
            questSlug: quests.slug,
          })
          .from(submissions)
          .innerJoin(quests, eq(quests.id, submissions.questId))
          .where(eq(submissions.id, subId));

        if (submissionInfo) {
          const [company] = await db
            .select({ name: customers.companyName })
            .from(customers)
            .where(eq(customers.id, customer.id));

          // Фоново, не ждём результата
          void notifyHeroByEmail({
            heroId: submissionInfo.heroId,
            companyName: company?.name ?? 'Компания',
            questTitle: submissionInfo.questTitle,
            questSlug: submissionInfo.questSlug,
            status: statusValue,
            note: note ?? null,
          });
        }
      } catch (e) {
        logger.error('employer/submissions:notify.failed', {
          message: (e as Error).message,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('employer/submissions:PATCH', {
      message: (e as Error).message,
    });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}