import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers, emailVerifications } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { withRetry } from '@/lib/db-retry';
import { sendEmail, verificationEmailHtml } from '@/lib/email';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const [row] = await withRetry(
      () =>
        db
          .select({
            emailVerifiedAt: customers.emailVerifiedAt,
            email: customers.email,
            companyName: customers.companyName,
          })
          .from(customers)
          .where(eq(customers.id, customer.id)),
      { label: 'verify:load-customer' },
    );

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'Компания не найдена' },
        { status: 404 },
      );
    }

    if (row.emailVerifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await withRetry(
      () =>
        db
          .delete(emailVerifications)
          .where(eq(emailVerifications.customerId, customer.id)),
      { label: 'verify:clean-old' },
    );

    await withRetry(
      () =>
        db.insert(emailVerifications).values({
          token,
          customerId: customer.id,
          expiresAt,
        }),
      { label: 'verify:create-token' },
    );

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/api/employer/auth/verify?token=${token}`;

    const sent = await sendEmail({
      to: row.email,
      subject: 'Подтвердите email на QuestWork',
      html: verificationEmailHtml(row.companyName, verifyUrl),
      text: `Подтвердите email: ${verifyUrl}`,
    });

    if (process.env.NODE_ENV !== 'production' || !sent) {
      logger.info('verify.link', { email: row.email, url: verifyUrl });
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      ok: true,
      sent,
      ...(isDev ? { verifyUrl } : {}),
    });
  } catch (e) {
    logger.error('verify.send.failed', { message: (e as Error).message });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}