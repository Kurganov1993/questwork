import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentHero } from '@/lib/auth';
import { getHeroNotifications } from '@/lib/notifications';
import { EMPLOYER_STATUSES, STATUS_STYLE } from '@/lib/employer-constants';
import { MarkAllSeenButton } from '@/components/MarkAllSeenButton';
import { InvitationRow } from '@/components/InvitationRow';

export const dynamic = 'force-dynamic';

export default async function InvitationsPage() {
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  const notifications = await getHeroNotifications(hero.id);
  const unseenCount = notifications.filter((n) => n.isNew).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/hero" className="text-sm text-zinc-500 hover:text-amber-400">
          ← В профиль
        </Link>

        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Решения работодателей</h1>
            <p className="text-zinc-400">
              {notifications.length === 0
                ? 'Пока нет ни одного отклика от компаний.'
                : `${notifications.length} отклик${notifications.length === 1 ? '' : 'ов'}${
                    unseenCount > 0 ? ` · ${unseenCount} новых` : ''
                  }`}
            </p>
          </div>
          {unseenCount > 0 && <MarkAllSeenButton />}
        </div>

        <div className="mt-6 space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500 text-sm">
              <div className="text-4xl mb-3">📭</div>
              Когда работодатель отметит вашу сдачу, здесь появится его
              решение.
              <div className="mt-4">
                <Link
                  href="/quests"
                  className="text-amber-400 hover:text-amber-300"
                >
                  К доске квестов →
                </Link>
              </div>
            </div>
          ) : (
            notifications.map((n) => (
              <InvitationRow
                key={n.submissionId}
                notification={{
                  submissionId: n.submissionId,
                  questTitle: n.questTitle,
                  questSlug: n.questSlug,
                  employerStatus: n.employerStatus,
                  employerNote: n.employerNote,
                  employerStatusAt: n.employerStatusAt.toISOString(),
                  isNew: n.isNew,
                }}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}