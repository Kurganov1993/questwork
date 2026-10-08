import { db } from '@/db';
import { submissions, quests, heroes } from '@/db/schema';
import { and, eq, isNull, isNotNull, desc } from 'drizzle-orm';
import { withRetry } from './db-retry';
import { sendEmail, invitationEmailHtml } from './email';
import { logger } from './logger';

export type EmployerNotification = {
  submissionId: number;
  questTitle: string;
  questSlug: string;
  employerStatus: string;
  employerNote: string | null;
  employerStatusAt: Date;
  isNew: boolean;
};

export async function getHeroNotifications(
  heroId: number,
): Promise<EmployerNotification[]> {
  try {
    const rows = await withRetry(
      () =>
        db
          .select({
            submissionId: submissions.id,
            employerStatus: submissions.employerStatus,
            employerNote: submissions.employerNote,
            employerStatusAt: submissions.employerStatusAt,
            heroSeenAt: submissions.heroSeenAt,
            questTitle: quests.title,
            questSlug: quests.slug,
          })
          .from(submissions)
          .innerJoin(quests, eq(quests.id, submissions.questId))
          .where(
            and(
              eq(submissions.heroId, heroId),
              isNotNull(submissions.employerStatus),
            ),
          )
          .orderBy(desc(submissions.employerStatusAt))
          .limit(50),
      { label: 'notif:list' },
    );

    return rows.map((r) => ({
      submissionId: r.submissionId,
      questTitle: r.questTitle,
      questSlug: r.questSlug,
      employerStatus: r.employerStatus ?? '',
      employerNote: r.employerNote,
      employerStatusAt: r.employerStatusAt ?? new Date(),
      isNew: !r.heroSeenAt,
    }));
  } catch (e) {
    console.error('[notif] failed:', (e as Error).message);
    return [];
  }
}

export async function countUnseenNotifications(
  heroId: number,
): Promise<number> {
  try {
    const rows = await withRetry(
      () =>
        db
          .select({ id: submissions.id })
          .from(submissions)
          .where(
            and(
              eq(submissions.heroId, heroId),
              isNotNull(submissions.employerStatus),
              isNull(submissions.heroSeenAt),
            ),
          ),
      { label: 'notif:count' },
    );
    return rows.length;
  } catch {
    return 0;
  }
}

export async function markNotificationSeen(
  heroId: number,
  submissionId: number,
): Promise<boolean> {
  try {
    await withRetry(
      () =>
        db
          .update(submissions)
          .set({ heroSeenAt: new Date() })
          .where(
            and(
              eq(submissions.id, submissionId),
              eq(submissions.heroId, heroId),
            ),
          ),
      { label: 'notif:mark-seen' },
    );
    return true;
  } catch {
    return false;
  }
}

export async function markAllSeen(heroId: number): Promise<boolean> {
  try {
    await withRetry(
      () =>
        db
          .update(submissions)
          .set({ heroSeenAt: new Date() })
          .where(
            and(
              eq(submissions.heroId, heroId),
              isNotNull(submissions.employerStatus),
              isNull(submissions.heroSeenAt),
            ),
          ),
      { label: 'notif:mark-all' },
    );
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Email-уведомления
// ============================================================

type NotifyInput = {
  heroId: number;
  companyName: string;
  questTitle: string;
  questSlug: string;
  status: 'shortlisted' | 'interview' | 'hired' | 'rejected';
  note: string | null;
};

/**
 * Отправляет email-уведомление герою о решении работодателя.
 * Пропускает, если email не задан, не подтверждён, или уведомления отключены.
 * Никогда не бросает — вызывается фоновым вызовом через void.
 */
export async function notifyHeroByEmail(
  input: NotifyInput,
): Promise<boolean> {
  try {
    const [hero] = await db
      .select({
        nickname: heroes.nickname,
        email: heroes.email,
        emailVerifiedAt: heroes.emailVerifiedAt,
        notifyByEmail: heroes.notifyByEmail,
      })
      .from(heroes)
      .where(eq(heroes.id, input.heroId));

    if (!hero || !hero.email) {
      logger.info('notify.skipped', {
        heroId: input.heroId,
        reason: 'no_email',
      });
      return false;
    }

    if (!hero.emailVerifiedAt) {
      logger.info('notify.skipped', {
        heroId: input.heroId,
        reason: 'email_not_verified',
      });
      return false;
    }

    if (!hero.notifyByEmail) {
      logger.info('notify.skipped', {
        heroId: input.heroId,
        reason: 'user_disabled',
      });
      return false;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const subjects: Record<NotifyInput['status'], string> = {
      shortlisted: `${input.companyName} добавила тебя в шортлист`,
      interview: `${input.companyName} приглашает на интервью`,
      hired: `🎉 ${input.companyName} хочет нанять тебя`,
      rejected: `${input.companyName} — решение по твоей сдаче`,
    };

    const sent = await sendEmail({
      to: hero.email,
      subject: subjects[input.status],
      html: invitationEmailHtml({
        heroNickname: hero.nickname,
        companyName: input.companyName,
        questTitle: input.questTitle,
        questSlug: input.questSlug,
        status: input.status,
        note: input.note,
        baseUrl,
      }),
      text: `${input.companyName}: ${subjects[input.status]}. Открыть: ${baseUrl}/hero/invitations`,
    });

    logger.info('notify.sent', {
      heroId: input.heroId,
      status: input.status,
      sent,
    });

    return sent;
  } catch (e) {
    logger.error('notify.failed', {
      heroId: input.heroId,
      message: (e as Error).message,
    });
    return false;
  }
}