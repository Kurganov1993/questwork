import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { submissions, quests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { EMPLOYER_STATUSES } from '@/lib/employer-constants';
import {
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer)
      return NextResponse.json(
        { ok: false, error: 'Нужно войти как работодатель' },
        { status: 401 },
      );

    const rl = await checkRateLimit(
      'submissionStatus',
      `customer:${customer.id}`,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

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

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[employer/submissions:PATCH]', e);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}