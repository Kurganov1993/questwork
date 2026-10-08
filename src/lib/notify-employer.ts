import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { sendEmail, submissionEmailHtml } from './email';
import { logger } from './logger';
import { withRetry } from './db-retry';

type NotifyEmployerInput = {
  customerId: number;
  heroNickname: string;
  questTitle: string;
  questSlug: string;
  status: 'victory' | 'defeat';
  damageDealt: number;
  bossMaxHp: number;
};

export async function notifyEmployerAboutSubmission(
  input: NotifyEmployerInput,
): Promise<boolean> {
  try {
    const [customer] = await withRetry(
      () =>
        db
          .select({
            email: customers.email,
            companyName: customers.companyName,
            emailVerifiedAt: customers.emailVerifiedAt,
          })
          .from(customers)
          .where(eq(customers.id, input.customerId)),
      { label: 'notify-employer:load' },
    );

    if (!customer?.emailVerifiedAt) {
      logger.info('notify-employer.skipped', {
        customerId: input.customerId,
        reason: 'not_verified',
      });
      return false;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const subject =
      input.status === 'victory'
        ? `🏆 ${input.heroNickname} победил в «${input.questTitle}»`
        : `⚔️ Новая сдача: ${input.heroNickname} — «${input.questTitle}»`;

    const sent = await sendEmail({
      to: customer.email,
      subject,
      html: submissionEmailHtml({
        companyName: customer.companyName,
        heroNickname: input.heroNickname,
        questTitle: input.questTitle,
        questSlug: input.questSlug,
        status: input.status,
        damageDealt: input.damageDealt,
        bossMaxHp: input.bossMaxHp,
        baseUrl,
      }),
      text: `${input.heroNickname} сдал «${input.questTitle}»: ${input.damageDealt}/${input.bossMaxHp}`,
    });

    logger.info('notify-employer.sent', {
      customerId: input.customerId,
      sent,
    });

    return sent;
  } catch (e) {
    logger.error('notify-employer.failed', {
      customerId: input.customerId,
      message: (e as Error).message,
    });
    return false;
  }
}