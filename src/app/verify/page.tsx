import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quests, bossPhases, submissions } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { isDockerAvailable } from '@/lib/docker/client';
import { HeroBackground } from '@/components/home/HeroBackground';
import { VerifyClient } from './VerifyClient';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ quest?: string; repo?: string }>;
}) {
  const { quest: questSlug, repo: initialRepo } = await searchParams;
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  const [quest] = await withRetry(
    () =>
      db
        .select()
        .from(quests)
        .where(eq(quests.slug, questSlug ?? 'create-shop')),
    { label: 'verify:get-quest' },
  );

  if (!quest) notFound();

  const phases = await withRetry(
    () =>
      db
        .select({
          phaseOrder: bossPhases.phaseOrder,
          name: bossPhases.name,
        })
        .from(bossPhases)
        .where(eq(bossPhases.questId, quest.id)),
    { label: 'verify:get-phases' },
  );

  const phaseNames = phases
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map((p) => p.name);

  let heroAttempts = { total: 0, victories: 0, best: 0 };
  try {
    const [agg] = await withRetry(
      () =>
        db
          .select({
            total: sql<number>`count(*)::int`,
            victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
            best: sql<number>`coalesce(max(${submissions.damageDealt}), 0)::int`,
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.heroId, hero.id),
              eq(submissions.questId, quest.id),
            ),
          ),
      { label: 'verify:attempts' },
    );

    heroAttempts = {
      total: Number(agg?.total ?? 0),
      victories: Number(agg?.victories ?? 0),
      best: Number(agg?.best ?? 0),
    };
  } catch (e) {
    console.error('[verify] attempts failed:', (e as Error).message);
  }

  let dockerAvailable = true;
  try {
    dockerAvailable = await isDockerAvailable();
  } catch {
    dockerAvailable = false;
  }

  const stars =
    '★'.repeat(quest.difficulty) +
    '☆'.repeat(Math.max(0, 5 - quest.difficulty));

  const bestPct = Math.round((heroAttempts.best / quest.bossMaxHp) * 100);
  const alreadyWon = heroAttempts.victories > 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-10">
          <Link
            href={`/quests/${quest.slug}`}
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← К квесту
          </Link>

          <div className="mt-6 flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-amber-300 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-dot" />
                <span className="tracking-widest font-mono">
                  АРЕНА · {phaseNames.length} ФАЗ
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-3">
                Проверка <span className="text-gradient-amber">кода</span>
              </h1>
              <p className="text-zinc-400">
                Сдай GitHub-репозиторий — платформа соберёт его в Docker,
                прогонит тесты и AI-ревью, снимая HP с босса.
              </p>
            </div>

            <div className="shrink-0 text-6xl leading-none drop-shadow-[0_0_30px_rgba(251,191,36,0.35)]">
              {quest.icon}
            </div>
          </div>

          {/* Docker warning */}
          {!dockerAvailable && (
            <div className="mt-8 glass rounded-2xl p-5 border-l-2 border-l-amber-500/60">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">🐳</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold mb-1 text-amber-200">
                    Docker недоступен
                  </div>
                  <div className="text-xs text-zinc-400">
                    Фазы «Сборка» и «Тесты» будут проверены эвристикой — по
                    файлам, а не реальным запуском. Результат может быть
                    неточным. Если запускаешь проект локально — включи Docker
                    Desktop и обнови страницу.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Инфо-карточка про квест и босса */}
          <div className="mt-6 glass rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-amber-500/10 blur-[80px]" />

            <div className="relative flex items-center justify-between gap-5 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="text-xs text-zinc-500 font-mono mb-1">
                  {stars} · СЛОЖНОСТЬ {quest.difficulty}
                </div>
                <div className="text-lg font-semibold mb-1">{quest.title}</div>
                <div className="text-xs text-zinc-500">
                  👑 {quest.bossName} · ❤️ {quest.bossMaxHp} HP · ✨{' '}
                  {quest.rewardXp} XP · 🪙 {quest.rewardGold}
                </div>
              </div>

              {heroAttempts.total > 0 && (
                <div className="flex gap-3 shrink-0">
                  <MiniStat
                    label="Попыток"
                    value={String(heroAttempts.total)}
                    icon="🎯"
                  />
                  <MiniStat
                    label="Лучший урон"
                    value={`${bestPct}%`}
                    icon="⚡"
                    accent={alreadyWon}
                  />
                </div>
              )}
            </div>

            {alreadyWon && (
              <div className="relative mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-300">
                <span>✔</span>
                <span>
                  Ты уже побеждал этого босса. Повторная победа даст 20%
                  награды без роста уровня.
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap text-xs">
            <Link
              href="/hero/github"
              className="inline-flex items-center gap-2 text-zinc-500 hover:text-amber-400 transition"
            >
              🐙 Мои репозитории GitHub →
            </Link>
            {initialRepo && (
              <span className="text-emerald-400">
                ✓ репозиторий подставлен из GitHub
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 pb-10">
        <VerifyClient
          questSlug={quest.slug}
          questTitle={quest.title}
          bossName={quest.bossName}
          bossMaxHp={quest.bossMaxHp}
          phaseNames={phaseNames}
          initialRepo={initialRepo}
          dockerAvailable={dockerAvailable}
        />
      </section>

      <section className="relative max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3 mb-4">
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
          ЧТО ПРОВЕРЯЕТСЯ
        </h2>

        <div className="glass rounded-2xl p-6">
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            {phaseNames.map((name, i) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/40 grid place-items-center text-xs font-mono text-amber-400 shrink-0">
                  {i + 1}
                </div>
                <div className="text-sm text-zinc-300 truncate">{name}</div>
              </div>
            ))}
          </div>

          <div className="pt-5 border-t border-white/5 grid sm:grid-cols-2 gap-4 text-xs">
            <Hint
              icon="⏱️"
              title="Первый прогон ~3–4 минуты"
              text="Docker скачивает зависимости и собирает проект. Повторные сдачи — быстрее за счёт кэша npm."
            />
            <Hint
              icon="🎯"
              title={`Порог победы ${quest.victoryThreshold}%`}
              text={`Нужно нанести не меньше ${quest.victoryThreshold}% урона от ${quest.bossMaxHp} HP. Фазы сдаются независимо.`}
            />
            <Hint
              icon="🔗"
              title="Публичный репозиторий"
              text="GitHub-репозиторий должен быть доступен по ссылке. Приватные — не поддерживаются."
            />
            <Hint
              icon="🔄"
              title="Повторная победа"
              text="Даёт 20% XP и золота, но без роста уровня. Хорошо для тренировки."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniStat({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 min-w-[110px]">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <span>{icon}</span>
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div
        className={`text-lg font-bold ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Hint({
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
      <div className="text-xl shrink-0">{icon}</div>
      <div>
        <div className="text-zinc-300 font-medium mb-1">{title}</div>
        <div className="text-zinc-500 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}