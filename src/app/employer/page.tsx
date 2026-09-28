import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '@/db';
import { quests, submissions } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { EmployerLogoutButton } from '@/components/EmployerLogoutButton';

export const dynamic = 'force-dynamic';

export default async function EmployerDashboard() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/employer/login');

  const myQuests = await db
    .select()
    .from(quests)
    .where(eq(quests.customerId, customer.id))
    .orderBy(desc(quests.createdAt));

  // Считаем сдачи по каждому квесту
  const stats = await db
    .select({
      questId: submissions.questId,
      total: sql<number>`count(*)::int`,
      victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
    })
    .from(submissions)
    .innerJoin(quests, eq(quests.id, submissions.questId))
    .where(eq(quests.customerId, customer.id))
    .groupBy(submissions.questId);

  const statsMap = new Map(stats.map((s) => [s.questId, s]));

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
            ← На главную
          </Link>
          <EmployerLogoutButton />
        </div>

        <div className="mt-4 flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="text-sm text-zinc-500">Кабинет работодателя</div>
            <h1 className="text-3xl font-bold">{customer.companyName}</h1>
            <div className="text-xs text-zinc-600 mt-1">{customer.email}</div>
          </div>
          <Link
            href="/employer/quests/new"
            className="shrink-0 px-5 py-2.5 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition text-sm"
          >
            + Создать квест
          </Link>
        </div>

        <h2 className="text-sm text-zinc-500 tracking-widest mb-3">
          МОИ КВЕСТЫ · {myQuests.length}
        </h2>

        {myQuests.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <div className="text-4xl mb-3">📜</div>
            <p className="text-zinc-400 mb-4">
              Ещё нет ни одного квеста. Создайте первый — и герои начнут его
              проходить.
            </p>
            <Link
              href="/employer/quests/new"
              className="inline-block px-5 py-2.5 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition text-sm"
            >
              Создать квест
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myQuests.map((q) => {
              const st = statsMap.get(q.id);
              const total = Number(st?.total ?? 0);
              const victories = Number(st?.victories ?? 0);
              const statusLabel =
                q.status === 'active'
                  ? 'активен'
                  : q.status === 'draft'
                  ? 'черновик'
                  : 'архив';
              const statusColor =
                q.status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : q.status === 'draft'
                  ? 'bg-zinc-500/20 text-zinc-300'
                  : 'bg-amber-500/20 text-amber-300';

              return (
                <Link
                  key={q.id}
                  href={`/employer/quests/${q.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-amber-500/60 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{q.icon}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{q.title}</h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-2 max-w-xl">
                          {q.description}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                          <span>👑 {q.bossName}</span>
                          <span>❤️ {q.bossMaxHp} HP</span>
                          <span>✨ {q.rewardXp} XP</span>
                          <span>🪙 {q.rewardGold}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-zinc-500 mb-1">Сдачи</div>
                      <div className="text-2xl font-semibold">{total}</div>
                      <div className="text-xs text-emerald-400">
                        {victories} побед
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}