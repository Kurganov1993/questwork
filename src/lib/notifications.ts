import { db } from '@/db';
import { submissions, quests } from '@/db/schema';
import { and, eq, isNull, isNotNull, desc } from 'drizzle-orm';
import { withRetry } from './db-retry';

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

export async function countUnseenNotifications(heroId: number): Promise<number> {
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