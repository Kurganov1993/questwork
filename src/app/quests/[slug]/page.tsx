import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quests, bossPhases, artifacts, customers, submissions, heroes } from '@/db/schema';
import { withRetry } from '@/lib/db-retry';
import { LootCard } from '@/components/LootCard';
import { HeroBackground } from '@/components/home/HeroBackground';
import { TiltCard } from '@/components/animations/TiltCard';
import { HERO_CLASSES } from '@/lib/constants';
import type { LootItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [quest] = await db
    .select({ title: quests.title, description: quests.description })
    .from(quests)
    .where(eq(quests.slug, slug));

  if (!quest) return { title: 'Квест не найден · QuestWork' };
  return {
    title: `${quest.title} · QuestWork`,
    description: quest.description.slice(0, 160),
  };
}

// Иконки и русские подписи для checkType
const CHECK_TYPE_META: Record<string, { icon: string; label: string }> = {
  repo_exists: { icon: '📁', label: 'Репозиторий' },
  readme: { icon: '📖', label: 'README' },
  build_config: { icon: '⚙️', label: 'Сборка' },
  build_real: { icon: '🐳', label: 'Docker сборка' },
  static_analysis: { icon: '🔍', label: 'Линтер' },
  tests: { icon: '🧪', label: 'Тесты' },
  tests_real: { icon: '🧪', label: 'Docker тесты' },
  deploy: { icon: '🚀', label: 'Деплой' },
  e2e: { icon: '🎭', label: 'E2E' },
  secrets: { icon: '🔒', label: 'Безопасность' },
  review: { icon: '👀', label: 'Ревью' },
  review_ai: { icon: '🤖', label: 'AI-ревью' },
  ci_workflow: { icon: '⚙️', label: 'CI' },
  ci_lint: { icon: '✨', label: 'CI линт' },
  ci_test: { icon: '🧪', label: 'CI тесты' },
  ci_build: { icon: '🔨', label: 'CI сборка' },
  ci_cache: { icon: '📦', label: 'Кэш' },
  cd_deploy: { icon: '🚀', label: 'CD деплой' },
};

export default async function QuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [quest] = await db
    .select({
      id: quests.id,
      slug: quests.slug,
      title: quests.title,
      description: quests.description,
      icon: quests.icon,
      bossName: quests.bossName,
      bossMaxHp: quests.bossMaxHp,
      difficulty: quests.difficulty,
      rewardXp: quests.rewardXp,
      rewardGold: quests.rewardGold,
      victoryThreshold: quests.victoryThreshold,
      status: quests.status,
      customerId: quests.customerId,
    })
    .from(quests)
    .where(eq(quests.slug, slug));

  if (!quest || quest.status !== 'active') notFound();

  const phases = await db
    .select()
    .from(bossPhases)
    .where(eq(bossPhases.questId, quest.id))
    .orderBy(bossPhases.phaseOrder);

  const questArtifacts = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.questId, quest.id));

  let customer: { companyName: string; slug: string } | null = null;
  if (quest.customerId) {
    const [c] = await db
      .select({
        companyName: customers.companyName,
        slug: customers.slug,
      })
      .from(customers)
      .where(eq(customers.id, quest.customerId));
    customer = c ?? null;
  }

  // ==================== Статистика прохождения ====================
  let stats = {
    total: 0,
    victories: 0,
    avgDamage: 0,
    bestHero: null as {
      nickname: string;
      heroClass: string;
      level: number;
      damageDealt: number;
    } | null,
  };

  try {
    const [agg] = await withRetry(
      () =>
        db
          .select({
            total: sql<number>`count(*)::int`,
            victories: sql<number>`count(*) filter (where ${submissions.status} = 'victory')::int`,
            avgDamage: sql<number>`coalesce(avg(${submissions.damageDealt}), 0)::int`,
          })
          .from(submissions)
          .where(eq(submissions.questId, quest.id)),
      { label: 'quest:stats' },
    );

    stats.total = Number(agg?.total ?? 0);
    stats.victories = Number(agg?.victories ?? 0);
    stats.avgDamage = Number(agg?.avgDamage ?? 0);

    const [best] = await withRetry(
      () =>
        db
          .select({
            nickname: heroes.nickname,
            heroClass: heroes.heroClass,
            level: heroes.level,
            damageDealt: submissions.damageDealt,
          })
          .from(submissions)
          .innerJoin(heroes, eq(heroes.id, submissions.heroId))
          .where(
            and(
              eq(submissions.questId, quest.id),
              eq(submissions.status, 'victory'),
            ),
          )
          .orderBy(desc(submissions.damageDealt))
          .limit(1),
      { label: 'quest:best' },
    );

    stats.bestHero = best ?? null;
  } catch (e) {
    console.error('[quest] stats failed:', (e as Error).message);
  }

  // ==================== Похожие квесты ====================
  let relatedQuests: (typeof quests.$inferSelect)[] = [];
  try {
    relatedQuests = await withRetry(
      () =>
        db
          .select()
          .from(quests)
          .where(eq(quests.status, 'active'))
          .orderBy(quests.difficulty)
          .limit(5),
      { label: 'quest:related' },
    );
    relatedQuests = relatedQuests.filter((q) => q.id !== quest.id).slice(0, 3);
  } catch (e) {
    console.error('[quest] related failed:', (e as Error).message);
  }

  const stars =
    '★'.repeat(quest.difficulty) +
    '☆'.repeat(Math.max(0, 5 - quest.difficulty));

  const winRate =
    stats.total > 0 ? Math.round((stats.victories / stats.total) * 100) : 0;
  const avgDamagePct = Math.round((stats.avgDamage / quest.bossMaxHp) * 100);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-10">
          <Link
            href="/quests"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← Все квесты
          </Link>

          {/* Основная карточка */}
          <div className="mt-6 glass rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-amber-500/15 blur-[100px]" />

            <div className="relative flex flex-col sm:flex-row items-start gap-6">
              {/* Иконка квеста */}
              <div className="shrink-0 text-7xl leading-none drop-shadow-[0_0_30px_rgba(251,191,36,0.35)]">
                {quest.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs font-mono tracking-widest text-amber-400">
                    {stars}
                  </span>
                  {customer && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-700/40">
                      от {customer.companyName}
                    </span>
                  )}
                  {stats.victories > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-700/40">
                      {stats.victories} побед
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                  {quest.title}
                </h1>
                <p className="text-zinc-400 mb-5">{quest.description}</p>

                {/* Метрики */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span>👑</span>
                    <span>{quest.bossName}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span>❤️</span>
                    <span>{quest.bossMaxHp} HP</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span>✨</span>
                    <span>{quest.rewardXp} XP</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span>🪙</span>
                    <span>{quest.rewardGold}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>порог {quest.victoryThreshold}%</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Большая CTA-кнопка */}
            <Link
              href={`/verify?quest=${quest.slug}`}
              className="relative block text-center w-full mt-7 py-4 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)] hover:shadow-[0_0_60px_-10px_rgba(251,191,36,0.9)] group"
            >
              <span className="inline-flex items-center gap-2">
                ⚔️ Принять квест
                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </span>
            </Link>
          </div>

          {/* ==================== Живая статистика ==================== */}
          {stats.total > 0 && (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Попыток" value={String(stats.total)} icon="🎯" />
              <StatCard
                label="Побед"
                value={String(stats.victories)}
                icon="🏆"
                accent
              />
              <StatCard label="Win rate" value={`${winRate}%`} icon="📊" />
              <StatCard
                label="Средний урон"
                value={`${avgDamagePct}%`}
                icon="⚡"
              />
            </div>
          )}
        </div>
      </section>

      {/* ==================== ЛУЧШИЙ ГЕРОЙ ==================== */}
      {stats.bestHero && (
        <section className="relative max-w-4xl mx-auto px-6 pb-10">
          <div className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className="text-3xl">🥇</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-500 tracking-widest mb-1">
                ЛУЧШИЙ РЕЗУЛЬТАТ
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/u/${stats.bestHero.nickname}`}
                  className="font-semibold hover:text-amber-400 transition"
                >
                  {HERO_CLASSES.find((c) => c.value === stats.bestHero!.heroClass)
                    ?.icon ?? '🧙'}{' '}
                  {stats.bestHero.nickname}
                </Link>
                <span className="text-xs text-zinc-500">
                  ур. {stats.bestHero.level}
                </span>
                <span className="text-xs text-amber-400">
                  {Math.round(
                    (stats.bestHero.damageDealt / quest.bossMaxHp) * 100,
                  )}
                  % урона
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================== НАГРАДА ЗА ПОБЕДУ ==================== */}
      {questArtifacts.length > 0 && (
        <section className="relative max-w-4xl mx-auto px-6 pb-10">
          <SectionLabel>НАГРАДА ЗА ПОБЕДУ</SectionLabel>
          <div className="space-y-2">
            {questArtifacts.map((a) => {
              const item: LootItem = {
                id: a.id,
                slug: a.slug,
                name: a.name,
                description: a.description,
                icon: a.icon,
                rarity: a.rarity as LootItem['rarity'],
                isNew: false,
              };
              return <LootCard key={a.id} item={item} />;
            })}
          </div>
        </section>
      )}

      {/* ==================== ФАЗЫ БОССА ==================== */}
      <section className="relative max-w-4xl mx-auto px-6 pb-10">
        <SectionLabel>
          ФАЗЫ БОССА · {phases.length} · {quest.bossMaxHp} HP
        </SectionLabel>

        <div className="space-y-2" data-cascade>
          {phases.map((p, idx) => {
            const meta = CHECK_TYPE_META[p.checkType] ?? {
              icon: '⚙️',
              label: p.checkType,
            };
            const hpPct = (p.maxHp / quest.bossMaxHp) * 100;

            return (
              <div
                key={p.id}
                data-cascade-item
                className="glass rounded-xl p-4 hover:bg-white/[0.03] transition relative overflow-hidden group"
              >
                {/* Прогресс-полоска HP */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500/5 to-transparent"
                  style={{ width: `${hpPct}%` }}
                />

                <div className="relative flex items-start gap-4">
                  <div className="text-xs font-mono text-zinc-600 w-6 pt-1 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </div>

                  <div className="text-2xl shrink-0">{meta.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-500 font-mono">
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {p.description}
                    </div>
                  </div>

                  <div className="text-xs text-amber-400 shrink-0 font-mono pt-1">
                    -{p.maxHp} HP
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== КАК ПРОХОДИТЬ ==================== */}
      <section className="relative max-w-4xl mx-auto px-6 pb-10">
        <SectionLabel>КАК ПРОХОДИТЬ</SectionLabel>

        <div className="glass rounded-2xl p-6">
          <div className="grid sm:grid-cols-3 gap-5">
            <Step
              num="1"
              icon="🔗"
              title="Сдай репозиторий"
              text="Открой /verify, вставь ссылку на GitHub. Платформа скачает код."
            />
            <Step
              num="2"
              icon="⚙️"
              title="Дождись проверки"
              text="Docker собирает, тесты прогоняются, ESLint и AI читают код."
            />
            <Step
              num="3"
              icon="⚔️"
              title="Победи босса"
              text={`Если урон ≥ ${quest.victoryThreshold}% от ${quest.bossMaxHp} HP — босс повержен, ты получаешь награды.`}
            />
          </div>

          <div className="mt-6 pt-5 border-t border-white/5 flex flex-wrap gap-3 text-xs">
            <span className="text-zinc-500">Учитывается:</span>
            <Badge>Docker сборка</Badge>
            <Badge>ESLint + Semgrep</Badge>
            <Badge>AI-ревью</Badge>
            <Badge>Тесты</Badge>
            <Badge>Безопасность</Badge>
          </div>
        </div>
      </section>

      {/* ==================== ПОХОЖИЕ КВЕСТЫ ==================== */}
      {relatedQuests.length > 0 && (
        <section className="relative max-w-4xl mx-auto px-6 pb-20">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel noMargin>ДРУГИЕ КВЕСТЫ</SectionLabel>
            <Link
              href="/quests"
              className="text-xs text-amber-400 hover:text-amber-300 transition"
            >
              все квесты →
            </Link>
          </div>

          <div className="space-y-2">
            {relatedQuests.map((q) => (
              <Link
                key={q.id}
                href={`/quests/${q.slug}`}
                className="glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.03] hover:border-amber-500/30 transition group"
              >
                <div className="text-3xl shrink-0">{q.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate group-hover:text-amber-400 transition">
                    {q.title}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    👑 {q.bossName} · ❤️ {q.bossMaxHp} HP · ✨ {q.rewardXp} XP
                  </div>
                </div>
                <div className="text-amber-400 text-sm shrink-0 opacity-60 group-hover:opacity-100 transition">
                  →
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ==================== ХЕЛПЕРЫ ====================

function SectionLabel({
  children,
  noMargin = false,
}: {
  children: React.ReactNode;
  noMargin?: boolean;
}) {
  return (
    <h2
      className={`text-sm font-mono tracking-[0.2em] text-zinc-500 flex items-center gap-3 ${
        noMargin ? '' : 'mb-4'
      }`}
    >
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
      {children}
    </h2>
  );
}

function StatCard({
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
    <div className="glass rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <span>{icon}</span>
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div
        className={`text-xl font-bold ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Step({
  num,
  icon,
  title,
  text,
}: {
  num: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 grid place-items-center text-xs font-mono text-amber-400">
          {num}
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
      <div className="font-medium mb-1">{title}</div>
      <div className="text-xs text-zinc-500 leading-relaxed">{text}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 rounded-md bg-white/5 text-zinc-400 border border-white/5">
      {children}
    </span>
  );
}