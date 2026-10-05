import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '@/db';
import { quests, submissions } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { withRetry } from '@/lib/db-retry';
import { EmployerLogoutButton } from '@/components/EmployerLogoutButton';
import { HeroBackground } from '@/components/home/HeroBackground';
import { TiltCard } from '@/components/animations/TiltCard';

export const dynamic = 'force-dynamic';

type StatusFilter = 'all' | 'active' | 'draft' | 'archived';

function parseStatus(value: string | undefined): StatusFilter {
  if (value === 'active' || value === 'draft' || value === 'archived')
    return value;
  return 'all';
}

export default async function EmployerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/employer/login');

  const { status: statusRaw } = await searchParams;
  const filter = parseStatus(statusRaw);

  // ==================== Квесты компании ====================
  let myQuests: (typeof quests.$inferSelect)[] = [];
  try {
    myQuests = await withRetry(
      () =>
        db
          .select()
          .from(quests)
          .where(eq(quests.customerId, customer.id))
          .orderBy(desc(quests.createdAt)),
      { label: 'employer:quests' },
    );
  } catch (e) {
    console.error('[employer] quests failed:', (e as Error).message);
  }

  // ==================== Статистика по сдачам ====================
  let statsMap = new Map<
    number,
    { total: number; victories: number; uniqueHeroes: number }
  >();

  try {
    const stats = await withRetry(
      () =>
        db
          .select({
            questId: submissions.questId,
            total: sql<number>`count(*)::int`,
            victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
            uniqueHeroes: sql<number>`count(distinct ${submissions.heroId})::int`,
          })
          .from(submissions)
          .innerJoin(quests, eq(quests.id, submissions.questId))
          .where(eq(quests.customerId, customer.id))
          .groupBy(submissions.questId),
      { label: 'employer:stats' },
    );

    statsMap = new Map(
      stats.map((s) => [
        s.questId,
        {
          total: Number(s.total),
          victories: Number(s.victories),
          uniqueHeroes: Number(s.uniqueHeroes),
        },
      ]),
    );
  } catch (e) {
    console.error('[employer] stats failed:', (e as Error).message);
  }

  // ==================== Сводная статистика ====================
  const totalQuests = myQuests.length;
  const activeQuests = myQuests.filter((q) => q.status === 'active').length;
  const draftQuests = myQuests.filter((q) => q.status === 'draft').length;
  const archivedQuests = myQuests.filter((q) => q.status === 'archived').length;

  const allStats = Array.from(statsMap.values());
  const totalSubmissions = allStats.reduce((s, v) => s + v.total, 0);
  const totalVictories = allStats.reduce((s, v) => s + v.victories, 0);
  const totalUniqueHeroes = new Set<number>().size; // placeholder
  const winRate =
    totalSubmissions > 0
      ? Math.round((totalVictories / totalSubmissions) * 100)
      : 0;

  // Уникальные герои по всем квестам компании
  let uniqueHeroesTotal = 0;
  try {
    const [agg] = await withRetry(
      () =>
        db
          .select({
            count: sql<number>`count(distinct ${submissions.heroId})::int`,
          })
          .from(submissions)
          .innerJoin(quests, eq(quests.id, submissions.questId))
          .where(eq(quests.customerId, customer.id)),
      { label: 'employer:unique-heroes' },
    );
    uniqueHeroesTotal = Number(agg?.count ?? 0);
  } catch (e) {
    console.error('[employer] unique-heroes failed:', (e as Error).message);
  }

  // ==================== Фильтрация по статусу ====================
  const visibleQuests = myQuests.filter((q) => {
    if (filter === 'all') return true;
    return q.status === filter;
  });

  const FILTERS: {
    value: StatusFilter;
    label: string;
    count: number;
    color: string;
  }[] = [
    { value: 'all', label: 'Все', count: totalQuests, color: 'amber' },
    { value: 'active', label: 'Активные', count: activeQuests, color: 'emerald' },
    { value: 'draft', label: 'Черновики', count: draftQuests, color: 'zinc' },
    { value: 'archived', label: 'Архив', count: archivedQuests, color: 'amber' },
  ];

  const isNewCompany =
    myQuests.length === 0 && totalSubmissions === 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-10">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
            >
              ← На главную
            </Link>
            <EmployerLogoutButton />
          </div>

          {/* Карточка компании */}
          <div className="glass rounded-3xl p-7 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-violet-500/15 blur-[80px]" />

            <div className="relative flex items-start gap-6 flex-wrap">
              {/* Логотип-инициал */}
              <div className="shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 border border-violet-500/30 grid place-items-center text-3xl font-bold text-violet-300">
                {customer.companyName.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-violet-300 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                  <span className="tracking-widest font-mono">
                    КАБИНЕТ РАБОТОДАТЕЛЯ
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                  {customer.companyName}
                </h1>
                <div className="text-sm text-zinc-500">{customer.email}</div>
              </div>

              <Link
                href="/employer/quests/new"
                className="shrink-0 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.5)] inline-flex items-center gap-2 group"
              >
                <span className="text-lg leading-none">+</span>
                Создать квест
                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* Сводная статистика */}
          {!isNewCompany && (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Квестов"
                value={String(totalQuests)}
                icon="📜"
                sub={
                  activeQuests > 0
                    ? `${activeQuests} активных`
                    : undefined
                }
              />
              <StatCard
                label="Сдач"
                value={String(totalSubmissions)}
                icon="🎯"
                sub={
                  totalUniqueHeroes > 0
                    ? `от ${uniqueHeroesTotal} героев`
                    : undefined
                }
              />
              <StatCard
                label="Побед"
                value={String(totalVictories)}
                icon="🏆"
                accent
              />
              <StatCard
                label="Win rate"
                value={`${winRate}%`}
                icon="📊"
              />
            </div>
          )}
        </div>
      </section>

      {/* ==================== ФИЛЬТРЫ ==================== */}
      {totalQuests > 0 && (
        <section className="relative max-w-5xl mx-auto px-6 pb-6">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              const disabled = f.count === 0 && !active;

              if (disabled) return null;

              return (
                <Link
                  key={f.value}
                  href={
                    f.value === 'all'
                      ? '/employer'
                      : `/employer?status=${f.value}`
                  }
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition border ${
                    active
                      ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                      : 'border-zinc-800 text-zinc-400 hover:border-amber-500/60 hover:text-amber-400'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      active
                        ? 'bg-black/20 text-black'
                        : 'bg-white/5 text-zinc-500'
                    }`}
                  >
                    {f.count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ==================== СПИСОК КВЕСТОВ ==================== */}
      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        {myQuests.length === 0 ? (
          <EmptyState />
        ) : visibleQuests.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center text-zinc-500">
            Нет квестов с этим статусом.{' '}
            <Link
              href="/employer"
              className="text-amber-400 hover:text-amber-300"
            >
              Показать все
            </Link>
          </div>
        ) : (
          <div className="space-y-4" data-cascade>
            {visibleQuests.map((q) => {
              const st = statsMap.get(q.id);
              const total = st?.total ?? 0;
              const victories = st?.victories ?? 0;
              const uniqueHeroes = st?.uniqueHeroes ?? 0;
              const winPct =
                total > 0 ? Math.round((victories / total) * 100) : 0;

              const statusMeta = {
                active: {
                  label: 'активен',
                  color: 'bg-emerald-500/15 text-emerald-300 border-emerald-700/40',
                },
                draft: {
                  label: 'черновик',
                  color: 'bg-zinc-500/15 text-zinc-300 border-zinc-700/40',
                },
                archived: {
                  label: 'архив',
                  color: 'bg-amber-500/15 text-amber-300 border-amber-700/40',
                },
              }[q.status];

              return (
                <div key={q.id} data-cascade-item>
                  <TiltCard max={2}>
                    <Link
                      href={`/employer/quests/${q.id}`}
                      className="block glass card-glow rounded-2xl p-6 relative overflow-hidden group"
                    >
                      <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl group-hover:bg-amber-500/20 transition-all duration-500" />

                      <div className="relative flex items-start justify-between gap-6 flex-wrap">
                        <div className="flex items-start gap-5 flex-1 min-w-0">
                          <div className="text-4xl shrink-0 drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                            {q.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold text-lg group-hover:text-amber-400 transition">
                                {q.title}
                              </h3>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border ${statusMeta.color}`}
                              >
                                {statusMeta.label}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-400 mb-3 line-clamp-2 max-w-2xl">
                              {q.description}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                              <span>👑 {q.bossName}</span>
                              <span>❤️ {q.bossMaxHp} HP</span>
                              <span>✨ {q.rewardXp} XP</span>
                              <span>🪙 {q.rewardGold}</span>
                              <span>порог {q.victoryThreshold}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Статы по квесту */}
                        <div className="shrink-0 flex gap-4">
                          <QuestStat
                            label="сдач"
                            value={total}
                            sub={
                              uniqueHeroes > 0
                                ? `${uniqueHeroes} героев`
                                : undefined
                            }
                          />
                          <QuestStat
                            label="побед"
                            value={victories}
                            sub={`${winPct}% winrate`}
                            accent={victories > 0}
                          />
                        </div>
                      </div>

                      {/* Прогресс-полоса winrate */}
                      {total > 0 && (
                        <div className="relative mt-4 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500/60 to-emerald-400 rounded-full transition-all"
                            style={{ width: `${winPct}%` }}
                          />
                        </div>
                      )}
                    </Link>
                  </TiltCard>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== ПОМОЩЬ ==================== */}
      {myQuests.length > 0 && (
        <section className="relative max-w-5xl mx-auto px-6 pb-20">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3 mb-5">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
              ЧТО ДАЛЬШЕ
            </h2>

            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <Tip
                icon="✏️"
                title="Редактируй квесты"
                text="Меняй название, описание, порог победы и фазы проверки — сдачи сохранятся."
              />
              <Tip
                icon="👥"
                title="Воронка найма"
                text="Отмечай героев: в шортлист, на интервью, нанят. Они увидят решение в профиле."
              />
              <Tip
                icon="📢"
                title="Поделись квестом"
                text="Ссылка на публичную страницу работает без логина — можно отправить кандидатам."
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

// ==================== ХЕЛПЕРЫ ====================

function StatCard({
  label,
  value,
  icon,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  icon: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <span>{icon}</span>
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div
        className={`text-2xl font-bold ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function QuestStat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center min-w-[70px]">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`text-3xl font-bold ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Tip({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="text-2xl shrink-0">{icon}</div>
      <div>
        <div className="font-medium mb-1 text-zinc-200">{title}</div>
        <div className="text-xs text-zinc-500 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-strong rounded-3xl p-12 text-center relative overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/20 blur-[100px] animate-pulse-glow" />

      <div className="relative">
        <div className="text-6xl mb-5">📜</div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
          Создайте первый квест
        </h2>
        <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
          Опишите задачу, задайте критерии проверки — и герои начнут её
          проходить. Платформа сама проверит код в Docker, прогонит тесты
          и оценит через AI.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/employer/quests/new"
            className="px-7 py-3.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)]"
          >
            + Создать квест
          </Link>
          <Link
            href="/quests"
            className="px-7 py-3.5 rounded-xl glass hover:bg-white/5 font-semibold transition"
          >
            Посмотреть примеры
          </Link>
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 grid sm:grid-cols-3 gap-4 text-left text-sm max-w-2xl mx-auto">
          <HowItWorks
            n="1"
            title="Опиши задачу"
            text="Название, босс, награды и порог победы."
          />
          <HowItWorks
            n="2"
            title="Настрой фазы"
            text="Какие проверки должен пройти репозиторий."
          />
          <HowItWorks
            n="3"
            title="Публикуй"
            text="Квест появится на доске для всех героев."
          />
        </div>
      </div>
    </div>
  );
}

function HowItWorks({
  n,
  title,
  text,
}: {
  n: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 grid place-items-center text-xs font-mono text-amber-400 shrink-0">
        {n}
      </div>
      <div>
        <div className="font-medium mb-1">{title}</div>
        <div className="text-xs text-zinc-500 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}