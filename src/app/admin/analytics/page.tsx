import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import {
  getAnalyticsSummary,
  getTopPages,
  getDailyViews,
  getTopReferrers,
} from '@/lib/analytics';
import { HeroBackground } from '@/components/home/HeroBackground';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) notFound();

  const [summary, topPages, daily, referrers] = await Promise.all([
    getAnalyticsSummary(),
    getTopPages(20),
    getDailyViews(14),
    getTopReferrers(10),
  ]);

  const maxDaily = Math.max(
    1,
    ...daily.map((d) => d.views),
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← В админку
          </Link>

          <div className="mt-6 mb-8">
            <h1 className="text-4xl font-bold">
              Метрика <span className="text-gradient-amber">посещений</span>
            </h1>
            <p className="text-zinc-400 mt-2">
              Собственный счётчик без внешних сервисов. IP хранятся в виде
              хеша, персональные данные не собираются.
            </p>
          </div>

          {/* Сводка */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Metric
              icon="📊"
              label="Сегодня"
              primary={summary.today.views}
              secondary={`${summary.today.unique} уник.`}
            />
            <Metric
              icon="📈"
              label="7 дней"
              primary={summary.last7d.views}
              secondary={`${summary.last7d.unique} уник.`}
            />
            <Metric
              icon="📅"
              label="30 дней"
              primary={summary.last30d.views}
              secondary={`${summary.last30d.unique} уник.`}
              accent
            />
          </div>

          {/* График */}
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
              ПРОСМОТРЫ · 14 ДНЕЙ
            </h2>

            {daily.length === 0 ? (
              <div className="text-sm text-zinc-600 py-8 text-center">
                Нет данных. Открой пару страниц — через минуту появятся.
              </div>
            ) : (
              <>
                <div className="flex items-end gap-1.5 h-40">
                  {daily.map((d) => {
                    const h1 = (d.views / maxDaily) * 100;
                    const h2 = (d.unique / maxDaily) * 100;
                    return (
                      <div
                        key={d.day}
                        className="flex-1 flex flex-col justify-end relative group"
                        title={`${d.day}: ${d.views} просмотров, ${d.unique} уник.`}
                      >
                        <div
                          className="w-full rounded-t bg-white/5 relative"
                          style={{ height: `${h1}%`, minHeight: '4px' }}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-t bg-gradient-to-t from-amber-500/80 to-amber-400"
                            style={{ height: `${h1 > 0 ? (h2 / h1) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-zinc-600 mt-2">
                  <span>14 дней назад</span>
                  <span>сегодня</span>
                </div>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Топ страниц */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
                ТОП СТРАНИЦ · 30 ДНЕЙ
              </h2>
              {topPages.length === 0 ? (
                <div className="text-sm text-zinc-600 py-8 text-center">
                  Нет данных
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {topPages.map((p, i) => {
                    const max = topPages[0]?.views ?? 1;
                    const w = (p.views / max) * 100;
                    return (
                      <div key={p.path}>
                        <div className="flex items-center justify-between text-xs mb-1 gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-zinc-600 font-mono shrink-0">
                              #{i + 1}
                            </span>
                            <span className="truncate font-mono text-zinc-300">
                              {p.path}
                            </span>
                          </span>
                          <span className="text-zinc-500 font-mono shrink-0">
                            {p.views} / {p.unique}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Источники */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 mb-5">
                ИСТОЧНИКИ · 30 ДНЕЙ
              </h2>
              {referrers.length === 0 ? (
                <div className="text-sm text-zinc-600 py-8 text-center">
                  Нет данных
                </div>
              ) : (
                <div className="space-y-2">
                  {referrers.map((r) => {
                    const max = referrers[0]?.count ?? 1;
                    const w = (r.count / max) * 100;
                    return (
                      <div key={r.host}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono text-zinc-300 truncate">
                            {r.host}
                          </span>
                          <span className="text-zinc-500 font-mono shrink-0 ml-2">
                            {r.count}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-violet-400"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
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
  primary,
  secondary,
  accent = false,
}: {
  icon: string;
  label: string;
  primary: number;
  secondary: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
        <span>{icon}</span>
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div
        className={`text-3xl font-bold mb-1 ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        {primary.toLocaleString('ru-RU')}
      </div>
      <div className="text-xs text-zinc-500">{secondary}</div>
    </div>
  );
}