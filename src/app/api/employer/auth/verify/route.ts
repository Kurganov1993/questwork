import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { customers, emailVerifications } from '@/db/schema';
import { withRetry } from '@/lib/db-retry';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      new URL('/employer?verify=missing_token', req.url),
    );
  }

  try {
    const [row] = await withRetry(
      () =>
        db
          .select({
            customerId: emailVerifications.customerId,
            expiresAt: emailVerifications.expiresAt,
          })
          .from(emailVerifications)
          .where(
            and(
              eq(emailVerifications.token, token),
              gt(emailVerifications.expiresAt, new Date()),
            ),
          ),
      { label: 'verify:load-token' },
    );

    if (!row) {
      return NextResponse.redirect(
        new URL('/employer?verify=invalid_token', req.url),
      );
    }

    await withRetry(
      () =>
        db
          .update(customers)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(customers.id, row.customerId)),
      { label: 'verify:mark-verified' },
    );

    await withRetry(
      () =>
        db
          .delete(emailVerifications)
          .where(eq(emailVerifications.token, token)),
      { label: 'verify:delete-token' },
    );

    logger.info('employer.email.verified', { customerId: row.customerId });

    return NextResponse.redirect(
      new URL('/employer?verify=success', req.url),
    );
  } catch (e) {
    logger.error('verify.confirm.failed', { message: (e as Error).message });
    return NextResponse.redirect(
      new URL('/employer?verify=error', req.url),
    );
  }
}