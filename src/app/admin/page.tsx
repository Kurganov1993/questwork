import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, gte, sql, eq } from 'drizzle-orm';
import { pluralize } from '@/lib/plural';
import { db } from '@/db';
import {
  heroes,
  customers,
  quests,
  submissions,
  aiUsage,
} from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { withRetry } from '@/lib/db-retry';
import { isDockerAvailable } from '@/lib/docker/client';
import { getProviderInfo } from '@/lib/ai/client';
import { HeroBackground } from '@/components/home/HeroBackground';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin.ok) notFound();

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    heroesStats,
    customersStats,
    submissionsStats,
    aiToday,
    ai7d,
    ai30d,
    aiByModel,
    topQuests,
    recentSubmissions,
    recentHeroes,
    dailyVictories,
  ] = await Promise.all([
    withRetry(
      () =>
        db
          .select({
            total: sql<number>`count(*)::int`,
            last24h: sql<number>`count(*) filter (where ${heroes.createdAt} >= ${dayAgo})::int`,
            last7d: sql<number>`count(*) filter (where ${heroes.createdAt} >= ${weekAgo})::int`,
          })
          .from(heroes),
      { label: 'admin:heroes-stats' },
    ).then((r) => r[0]),

    withRetry(
      () =>
        db
          .select({
            total: sql<number>`count(*)::int`,
            verified: sql<number>`count(*) filter (where ${customers.emailVerifiedAt} is not null)::int`,
            last7d: sql<number>`count(*) filter (where ${customers.createdAt} >= ${weekAgo})::int`,
          })
          .from(customers),
      { label: 'admin:customers-stats' },
    ).then((r) => r[0]),

    withRetry(
      () =>
        db
          .select({
            total: sql<number>`count(*)::int`,
            victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
            defeats: sql<number>`count(*) filter (where ${submissions.status} = 'defeat')::int`,
            last24h: sql<number>`count(*) filter (where ${submissions.createdAt} >= ${dayAgo})::int`,
            last7d: sql<number>`count(*) filter (where ${submissions.createdAt} >= ${weekAgo})::int`,
          })
          .from(submissions),
      { label: 'admin:submissions-stats' },
    ).then((r) => r[0]),

    withRetry(
      () =>
        db
          .select({
            calls: sql<number>`count(*)::int`,
            costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
            tokensIn: sql<number>`coalesce(sum(${aiUsage.tokensIn}), 0)::int`,
            tokensOut: sql<number>`coalesce(sum(${aiUsage.tokensOut}), 0)::int`,
            errors: sql<number>`count(*) filter (where ${aiUsage.status} = 'error')::int`,
          })
          .from(aiUsage)
          .where(gte(aiUsage.createdAt, dayAgo)),
      { label: 'admin:ai-today' },
    ).then((r) => r[0]),

    withRetry(
      () =>
        db
          .select({
            calls: sql<number>`count(*)::int`,
            costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
          })
          .from(aiUsage)
          .where(gte(aiUsage.createdAt, weekAgo)),
      { label: 'admin:ai-7d' },
    ).then((r) => r[0]),

    withRetry(
      () =>
        db
          .select({
            calls: sql<number>`count(*)::int`,
            costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
          })
          .from(aiUsage)
          .where(gte(aiUsage.createdAt, monthAgo)),
      { label: 'admin:ai-30d' },
    ).then((r) => r[0]),

    withRetry(
      () =>
        db
          .select({
            model: aiUsage.model,
            calls: sql<number>`count(*)::int`,
            costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float`,
          })
          .from(aiUsage)
          .where(gte(aiUsage.createdAt, monthAgo))
          .groupBy(aiUsage.model)
          .orderBy(desc(sql`sum(${aiUsage.costUsd})`))
          .limit(10),
      { label: 'admin:ai-by-model' },
    ).catch(() => []),

    withRetry(
      () =>
        db
          .select({
            slug: quests.slug,
            title: quests.title,
            icon: quests.icon,
            total: sql<number>`count(${submissions.id})::int`,
            victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
          })
          .from(quests)
          .leftJoin(submissions, eq(submissions.questId, quests.id))
          .groupBy(quests.id, quests.slug, quests.title, quests.icon)
          .orderBy(desc(sql`count(${submissions.id})`))
          .limit(10),
      { label: 'admin:top-quests' },
    ).catch(() => []),

    withRetry(
      () =>
        db
          .select({
            id: submissions.id,
            repoUrl: submissions.repoUrl,
            status: submissions.status,
            damageDealt: submissions.damageDealt,
            createdAt: submissions.createdAt,
            heroNickname: heroes.nickname,
            questTitle: quests.title,
            questIcon: quests.icon,
          })
          .from(submissions)
          .innerJoin(heroes, eq(heroes.id, submissions.heroId))
          .innerJoin(quests, eq(quests.id, submissions.questId))
          .orderBy(desc(submissions.createdAt))
          .limit(15),
      { label: 'admin:recent-subs' },
    ).catch(() => []),

    withRetry(
      () =>
        db
          .select({
            id: heroes.id,
            nickname: heroes.nickname,
            heroClass: heroes.heroClass,
            level: heroes.level,
            createdAt: heroes.createdAt,
          })
          .from(heroes)
          .orderBy(desc(heroes.createdAt))
          .limit(10),
      { label: 'admin:recent-heroes' },
    ).catch(() => []),

    withRetry(
      () =>
        db
          .select({
            day: sql<string>`to_char(${submissions.createdAt}::date, 'YYYY-MM-DD')`,
            victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
            total: sql<number>`count(*)::int`,
          })
          .from(submissions)
          .where(
            gte(
              submissions.createdAt,
              new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
            ),
          )
          .groupBy(sql`${submissions.createdAt}::date`)
          .orderBy(sql`${submissions.createdAt}::date`),
      { label: 'admin:daily-victories' },
    ).catch(() => []),
  ]);

  let dockerOk = false;
  try {
    dockerOk = await isDockerAvailable();
  } catch {
    /* ignore */
  }

  const aiInfo = getProviderInfo();

  const heroTotal = Number(heroesStats?.total ?? 0);
  const heroLast24h = Number(heroesStats?.last24h ?? 0);
  const heroLast7d = Number(heroesStats?.last7d ?? 0);

  const custTotal = Number(customersStats?.total ?? 0);
  const custVerified = Number(customersStats?.verified ?? 0);
  const custLast7d = Number(customersStats?.last7d ?? 0);

  const subTotal = Number(submissionsStats?.total ?? 0);
  const subVictories = Number(submissionsStats?.victories ?? 0);
  const subDefeats = Number(submissionsStats?.defeats ?? 0);
  const subLast24h = Number(submissionsStats?.last24h ?? 0);
  const subLast7d = Number(submissionsStats?.last7d ?? 0);
  const winRate = subTotal > 0 ? Math.round((subVictories / subTotal) * 100) : 0;

  const aiTodayCalls = Number(aiToday?.calls ?? 0);
  const aiTodayCost = Number(aiToday?.costUsd ?? 0);
  const aiTodayErrors = Number(aiToday?.errors ?? 0);

  const ai7dCalls = Number(ai7d?.calls ?? 0);
  const ai7dCost = Number(ai7d?.costUsd ?? 0);

  const ai30dCalls = Number(ai30d?.calls ?? 0);
  const ai30dCost = Number(ai30d?.costUsd ?? 0);

  const avgCost = ai30dCalls > 0 ? ai30dCost / ai30dCalls : 0;
  const dailyAvgCost = ai30dCost / 30;
  const forecastMonth = dailyAvgCost * 30;

  const maxDaily = Math.max(
    1,
    ...dailyVictories.map((d) => Number(d.total ?? 0)),
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
              >
                ← На главную
              </Link>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-amber-300 mt-4 mb-3 ml-4">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" />
                <span className="tracking-widest font-mono">
                  ADMIN · {admin.nickname}
                </span>
              </div>
              <h1 className="text-4xl font-bold">
                Панель <span className="text-gradient-amber">управления</span>
              </h1>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/admin/analytics"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass text-sm text-zinc-300 hover:text-amber-400 transition"
              >
                📊 Метрика
              </Link>
              <StatusPill
                label="Docker"
                ok={dockerOk}
                okText="запущен"
                failText="выключен"
              />
              <StatusPill
                label="AI"
                ok={aiInfo.ready}
                okText={aiInfo.model || 'готов'}
                failText="не настроен"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Metric
              icon="🧙"
              label="Героев"
              value={heroTotal}
              sub={`+${heroLast24h} за 24ч · +${heroLast7d} за 7д`}
            />
            <Metric
              icon="🏢"
              label="Работодателей"
              value={custTotal}
              sub={`${custVerified} подтверждено · +${custLast7d} за 7д`}
            />
                        <Metric
              icon="⚔️"
              label="Сдач"
              value={subTotal}
              sub={`${pluralize(subVictories, ['победа', 'победы', 'побед'])} · ${pluralize(subDefeats, ['поражение', 'поражения', 'поражений'])} · ${winRate}% win`}
              accent
            />
            <Metric
              icon="🎯"
              label="Сдач за 24ч"
              value={subLast24h}
              sub={`${subLast7d} за 7 дней`}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <Metric
              icon="💵"
              label="AI за сегодня"
              value={`$${aiTodayCost.toFixed(4)}`}
              sub={`${aiTodayCalls} запросов · ${aiTodayErrors} ошибок`}
              accent
            />
            <Metric
              icon="📊"
              label="AI за 7 дней"
              value={`$${ai7dCost.toFixed(4)}`}
              sub={`${ai7dCalls} запросов`}
            />
            <Metric
              icon="📈"
              label="Прогноз 30 дней"
              value={`$${forecastMonth.toFixed(2)}`}
              sub={`средняя $${avgCost.toFixed(4)} за запрос`}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
                АКТИВНОСТЬ · 14 ДНЕЙ
              </h2>

              {dailyVictories.length === 0 ? (
                <div className="text-sm text-zinc-600 py-8 text-center">
                  Нет данных
                </div>
              ) : (
                <div className="flex items-end gap-1.5 h-40">
                  {dailyVictories.map((d) => {
                    const total = Number(d.total ?? 0);
                    const wins = Number(d.victories ?? 0);
                    const totalH = (total / maxDaily) * 100;
                    const winsH = (wins / maxDaily) * 100;
                    return (
                      <div
                        key={d.day}
                        className="flex-1 flex flex-col justify-end relative group"
                        title={`${d.day}: ${wins}/${total}`}
                      >
                        <div
                          className="w-full rounded-t bg-white/5 relative"
                          style={{ height: `${totalH}%`, minHeight: '4px' }}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-t bg-gradient-to-t from-emerald-500/80 to-emerald-400"
                            style={{
                              height: `${
                                total > 0 ? (winsH / totalH) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between text-xs text-zinc-600 mt-2">
                <span>14 дней назад</span>
                <span>сегодня</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
                ТОП КВЕСТОВ
              </h2>

              {topQuests.length === 0 ? (
                <div className="text-sm text-zinc-600 py-8 text-center">
                  Нет данных
                </div>
              ) : (
                <div className="space-y-2">
                  {topQuests.map((q) => {
                    const total = Number(q.total ?? 0);
                    const vic = Number(q.victories ?? 0);
                    const wr = total > 0 ? Math.round((vic / total) * 100) : 0;
                    const maxTotal = Math.max(
                      ...topQuests.map((t) => Number(t.total ?? 0)),
                      1,
                    );
                    const barW = (total / maxTotal) * 100;
                    return (
                      <div key={q.slug}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 truncate">
                            <span>{q.icon}</span>
                            <span className="truncate">{q.title}</span>
                          </span>
                          <span className="text-zinc-500 font-mono shrink-0 ml-2">
                            {total} сдач · {wr}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400"
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {aiByModel.length > 0 && (
            <div className="glass rounded-2xl p-6 mb-6">
              <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
                AI ПО МОДЕЛЯМ · 30 ДНЕЙ
              </h2>
              <div className="space-y-2">
                {aiByModel.map((m) => (
                  <div
                    key={m.model}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-b-0"
                  >
                    <span className="font-mono text-zinc-400 truncate">
                      {m.model}
                    </span>
                    <span className="text-zinc-300 shrink-0 ml-4">
                      {m.calls} звонков · ${Number(m.costUsd).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
                ПОСЛЕДНИЕ СДАЧИ
              </h2>
              {recentSubmissions.length === 0 ? (
                <div className="text-sm text-zinc-600 py-8 text-center">
                  Нет данных
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {recentSubmissions.map((s) => {
                    const victory = s.status === 'victory';
                    return (
                      <div
                        key={s.id}
                        className={`flex items-start gap-3 text-xs p-2.5 rounded-lg ${
                          victory
                            ? 'bg-emerald-500/5 border border-emerald-700/20'
                            : 'bg-red-500/5 border border-red-700/20'
                        }`}
                      >
                        <span className="text-lg shrink-0">
                          {s.questIcon ?? '⚔️'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium truncate">
                              {s.heroNickname}
                            </span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-zinc-500 truncate">
                              {s.questTitle}
                            </span>
                          </div>
                          <a
                            href={s.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-600 font-mono truncate block hover:text-amber-400"
                          >
                            {s.repoUrl}
                          </a>
                        </div>
                        <span
                          className={`text-xs shrink-0 ${
                            victory ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {victory ? '✓' : '✗'} {s.damageDealt}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
                НОВЫЕ ГЕРОИ
              </h2>
              {recentHeroes.length === 0 ? (
                <div className="text-sm text-zinc-600 py-8 text-center">
                  Нет данных
                </div>
              ) : (
                <div className="space-y-2">
                  {recentHeroes.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 font-mono text-xs">
                          #{h.id}
                        </span>
                        <Link
                          href={`/u/${h.nickname}`}
                          className="hover:text-amber-400 transition"
                        >
                          {h.nickname}
                        </Link>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="font-mono">{h.heroClass}</span>
                        <span>ур. {h.level}</span>
                        <span>
                          {new Date(h.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 text-xs text-zinc-600 text-center">
            Данные обновлены в {new Date().toLocaleTimeString('ru-RU')} ·
            обнови страницу
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-4">
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
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusPill({
  label,
  ok,
  okText,
  failText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  failText: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
        ok
          ? 'bg-emerald-500/10 border-emerald-700/40 text-emerald-300'
          : 'bg-red-500/10 border-red-700/40 text-red-300'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          ok ? 'bg-emerald-400' : 'bg-red-400'
        }`}
      />
      <span className="font-mono">{label}:</span>
      <span>{ok ? okText : failText}</span>
    </div>
  );
}