import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quests, heroes, submissions, customers } from '@/db/schema';
import { withRetry } from '@/lib/db-retry';
import { getCurrentHero } from '@/lib/auth';
import { pluralWord, pluralize } from '@/lib/plural';
import { PLATFORM } from '@/lib/platform';
import { HeroBackground } from '@/components/home/HeroBackground';
import { AnimatedNumber } from '@/components/home/AnimatedNumber';
import { VictoryTicker } from '@/components/home/VictoryTicker';
import { HomeAnimations } from '@/components/animations/HomeAnimations';
import { SplitHeroTitle } from '@/components/animations/SplitHeroTitle';
import { MagneticButton } from '@/components/animations/MagneticButton';
import { TiltCard } from '@/components/animations/TiltCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const currentHero = await getCurrentHero();

  // Если залогинен — сразу на рабочий стол
  if (currentHero) {
    redirect('/dashboard');
  }

  const [stats, recentVictories] = await Promise.all([
    loadStats(),
    withRetry(
      () =>
        db
          .select({
            id: submissions.id,
            damageDealt: submissions.damageDealt,
            heroNickname: heroes.nickname,
            heroClass: heroes.heroClass,
            questTitle: quests.title,
            questIcon: quests.icon,
            questSlug: quests.slug,
            bossMaxHp: quests.bossMaxHp,
            bossName: quests.bossName,
          })
          .from(submissions)
          .innerJoin(heroes, eq(heroes.id, submissions.heroId))
          .innerJoin(quests, eq(quests.id, submissions.questId))
          .where(eq(submissions.status, 'victory'))
          .orderBy(desc(submissions.createdAt))
          .limit(8),
      { label: 'home:victories' },
    ).catch(() => []),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-amber-300 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              <span className="tracking-widest font-mono">НАЙМ КАК РЕЙД</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">
                {stats.totalVictories > 0
                  ? `${pluralize(stats.totalVictories, [
                      'победа',
                      'победы',
                      'побед',
                    ])} на платформе`
                  : 'первый сезон'}
              </span>
            </div>
          </div>

          <SplitHeroTitle />

          <p
            className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 animate-fade-in-up"
            style={{ animationDelay: '0.4s' }}
          >
            Никаких откликов в пустоту. Сдаёшь GitHub-репозиторий — платформа
            собирает его в Docker, прогоняет тесты, читает код через AI и
            снимает HP с босса. Портфолио — твой персонаж.
          </p>

          <div
            className="flex gap-4 justify-center flex-wrap animate-fade-in-up"
            style={{ animationDelay: '0.5s' }}
          >
            <MagneticButton>
              <Link
                href="/register"
                className="block px-7 py-3.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)] hover:shadow-[0_0_60px_-10px_rgba(251,191,36,0.8)]"
              >
                Создать героя
              </Link>
            </MagneticButton>

            <MagneticButton>
              <Link
                href="/quests"
                className="block px-7 py-3.5 rounded-lg glass hover:bg-white/5 font-semibold transition"
              >
                Посмотреть квесты
              </Link>
            </MagneticButton>
          </div>

          {stats.totalHeroes > 0 && (
            <div
              data-reveal
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mt-16"
            >
              <Stat
                value={stats.totalHeroes}
                icon="🧙"
                forms={['герой', 'героя', 'героев']}
              />
              <Stat
                value={stats.activeQuests}
                icon="📜"
                forms={['квест', 'квеста', 'квестов']}
              />
              <Stat
                value={stats.totalVictories}
                icon="⚔️"
                forms={['победа', 'победы', 'побед']}
                accent
              />
              <Stat
                value={stats.totalCustomers}
                icon="🏢"
                forms={['компания', 'компании', 'компаний']}
              />
            </div>
          )}
        </div>
      </section>

      {/* ==================== ЖИВАЯ ЛЕНТА ==================== */}
      {recentVictories.length > 0 && (
        <VictoryTicker
          victories={recentVictories.map((v) => ({
            id: v.id,
            heroNickname: v.heroNickname,
            heroClass: v.heroClass,
            questTitle: v.questTitle,
            questIcon: v.questIcon,
            questSlug: v.questSlug,
            bossName: v.bossName,
            damageDealt: v.damageDealt,
            bossMaxHp: v.bossMaxHp,
          }))}
        />
      )}

      {/* ==================== КАК ЭТО РАБОТАЕТ ==================== */}
      <section className="relative max-w-6xl mx-auto px-6 py-20">
        <div data-reveal>
          <SectionHeader title="КАК ЭТО РАБОТАЕТ" centered />
        </div>

        <div className="grid md:grid-cols-4 gap-4" data-cascade>
          {[
            {
              n: '01',
              t: 'Выбери класс',
              d: 'Frontend Mage, Backend Warrior, DevOps Paladin, QA Rogue.',
              icon: '🧙',
            },
            {
              n: '02',
              t: 'Возьми квест',
              d: 'Задача с критериями и боссом. Набор фаз проверки.',
              icon: '📜',
            },
            {
              n: '03',
              t: 'Сдай репозиторий',
              d: 'Docker собирает, тесты прогоняются, AI читает код.',
              icon: '⚔️',
            },
            {
              n: '04',
              t: 'Победи босса',
              d: 'XP, золото, артефакты, достижения. Профиль растёт.',
              icon: '🏆',
            },
          ].map((s) => (
            <div key={s.n} data-cascade-item>
              <div className="glass rounded-2xl p-5 card-glow h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl drop-shadow-[0_0_16px_rgba(251,191,36,0.2)]">
                    {s.icon}
                  </div>
                  <div className="text-xs font-mono text-amber-500/60">
                    {s.n}
                  </div>
                </div>
                <div className="font-semibold mb-2">{s.t}</div>
                <div className="text-sm text-zinc-400 leading-relaxed">
                  {s.d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== КОМУ ЭТО ==================== */}
      <section className="relative max-w-6xl mx-auto px-6 py-20">
        <div data-reveal>
          <SectionHeader title="КОМУ ЭТО НУЖНО" centered />
        </div>

        <div className="grid md:grid-cols-2 gap-5" data-cascade>
          <div data-cascade-item>
            <TiltCard max={4}>
              <AudienceCard
                icon="🧙"
                title="Разработчикам"
                subtitle="Хватит отправлять резюме в пустоту"
                bullets={[
                  'Docker реально собирает твой проект',
                  'ESLint + Semgrep находят баги и уязвимости',
                  'AI-ревью читает код и объясняет, что улучшить',
                  'Профиль с артефактами вместо PDF-резюме',
                ]}
                cta={{ href: '/register', label: 'Создать героя' }}
                accent="amber"
              />
            </TiltCard>
          </div>

          <div data-cascade-item>
            <TiltCard max={4}>
              <AudienceCard
                icon="🏢"
                title="Работодателям"
                subtitle="Хватит читать «уверенное владение React»"
                bullets={[
                  'Публикуй задачи с проверяемыми критериями',
                  'Автоматическая проверка каждой сдачи',
                  'Воронка: шортлист → интервью → найм',
                  'Публичные профили героев без логина',
                ]}
                cta={{ href: '/employer/register', label: 'Создать квест' }}
                accent="violet"
              />
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ==================== ФИНАЛЬНЫЙ CTA ==================== */}
      <section className="relative max-w-4xl mx-auto px-6 py-20">
        <div
          data-reveal
          className="relative glass-strong rounded-3xl p-12 text-center overflow-hidden"
        >
          <div
            data-glow
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/20 blur-[100px]"
          />

          <div className="relative">
            <div className="text-5xl mb-6 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]">
              ⚔️
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Один репозиторий —<br />
              <span className="text-gradient-amber">и ты знаешь всё</span>
            </h2>
            <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
              Не нужно ждать ответа HR-бота. Сдай квест и получи полный отчёт:
              собирается ли код, что говорит линтер, что находит AI и сколько
              HP осталось у босса.
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              <MagneticButton>
                <Link
                  href="/register"
                  className="block px-7 py-3.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)]"
                >
                  Начать путь героя
                </Link>
              </MagneticButton>

              <MagneticButton>
                <Link
                  href="/quests"
                  className="block px-7 py-3.5 rounded-lg glass hover:bg-white/5 font-semibold transition"
                >
                  Посмотреть квесты
                </Link>
              </MagneticButton>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-white/5 py-10 mt-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-400 font-bold font-display text-lg">
                {PLATFORM.monogram}
              </div>
              <div>
                <div className="text-sm font-semibold font-display tracking-[0.15em]">
                  {PLATFORM.shortName}
                </div>
                <div className="text-xs text-zinc-600">
                  {PLATFORM.tagline} · бета-версия
                </div>
              </div>
            </div>

            <nav className="flex flex-wrap gap-6 text-sm text-zinc-500">
              <Link href="/quests" className="hover:text-amber-400 transition">
                Квесты
              </Link>
              <Link
                href="/leaderboard"
                className="hover:text-amber-400 transition"
              >
                Лидерборд
              </Link>
              <Link
                href="/employer"
                className="hover:text-amber-400 transition"
              >
                Работодателям
              </Link>
              <Link
                href="/register"
                className="hover:text-amber-400 transition"
              >
                Создать героя
              </Link>
            </nav>
          </div>

          <div className="w-full mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-4 justify-center text-xs text-zinc-600">
            <Link href="/about" className="hover:text-amber-400 transition">
              О проекте
            </Link>
            <span className="text-zinc-700">·</span>
            <Link href="/contact" className="hover:text-amber-400 transition">
              Связаться
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/legal/privacy"
              className="hover:text-amber-400 transition"
            >
              Конфиденциальность
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/legal/terms"
              className="hover:text-amber-400 transition"
            >
              Пользовательское соглашение
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/legal/cookies"
              className="hover:text-amber-400 transition"
            >
              Cookie
            </Link>
          </div>

          <div className="mt-4 text-center text-xs text-zinc-700">
            © {new Date().getFullYear()} {PLATFORM.name}. Все права защищены.
          </div>
        </div>
      </footer>

      <HomeAnimations />
    </main>
  );
}

function Stat({
  value,
  icon,
  forms,
  accent = false,
}: {
  value: number;
  icon: string;
  forms: [string, string, string];
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div
        className={`text-2xl font-bold ${
          accent ? 'text-gradient-amber' : 'text-zinc-100'
        }`}
      >
        <AnimatedNumber value={value} />
      </div>
      <div className="text-xs text-zinc-500 mt-0.5 tracking-wide uppercase">
        {pluralWord(value, forms)}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  centered = false,
}: {
  title: string;
  centered?: boolean;
}) {
  return (
    <div
      className={`flex items-center ${
        centered ? 'justify-center' : 'justify-between'
      } mb-8 gap-4`}
    >
      <div className="flex items-center gap-3">
        <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/60" />
        <h2 className="text-sm font-mono tracking-[0.2em] text-zinc-500">
          {title}
        </h2>
        <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/60" />
      </div>
    </div>
  );
}

function AudienceCard({
  icon,
  title,
  subtitle,
  bullets,
  cta,
  accent,
}: {
  icon: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta: { href: string; label: string };
  accent: 'amber' | 'violet';
}) {
  const accentGradient =
    accent === 'amber'
      ? 'from-amber-500/20 to-transparent'
      : 'from-violet-500/20 to-transparent';

  const accentText =
    accent === 'amber' ? 'text-amber-400' : 'text-violet-400';

  const ctaClass =
    accent === 'amber'
      ? 'bg-amber-500 text-black hover:bg-amber-400'
      : 'border border-violet-500/40 text-violet-300 hover:bg-violet-500/10';

  return (
    <div className="glass rounded-2xl p-7 relative overflow-hidden card-glow h-full">
      <div
        className={`absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-to-br ${accentGradient} blur-3xl`}
      />

      <div className="relative">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-2xl font-semibold mb-1">{title}</h3>
        <p className={`text-sm ${accentText} mb-6`}>{subtitle}</p>

        <ul className="space-y-3 mb-7">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-3 text-sm text-zinc-300">
              <span
                className={`shrink-0 mt-0.5 ${
                  accent === 'amber' ? 'text-amber-400' : 'text-violet-400'
                }`}
              >
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <Link
          href={cta.href}
          className={`block w-full text-center px-5 py-3 rounded-lg font-semibold transition ${ctaClass}`}
        >
          {cta.label}
        </Link>
      </div>
    </div>
  );
}

async function loadStats() {
  const empty = {
    totalHeroes: 0,
    activeQuests: 0,
    totalVictories: 0,
    totalCustomers: 0,
  };

  try {
    const [heroesCount, questsCount, victoriesCount, customersCount] =
      await Promise.all([
        withRetry(
          () =>
            db.select({ count: sql<number>`count(*)::int` }).from(heroes),
          { label: 'home:stat-heroes' },
        ).then((r) => Number(r[0]?.count ?? 0)),
        withRetry(
          () =>
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(quests)
              .where(eq(quests.status, 'active')),
          { label: 'home:stat-quests' },
        ).then((r) => Number(r[0]?.count ?? 0)),
        withRetry(
          () =>
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(submissions)
              .where(eq(submissions.status, 'victory')),
          { label: 'home:stat-victories' },
        ).then((r) => Number(r[0]?.count ?? 0)),
        withRetry(
          () =>
            db.select({ count: sql<number>`count(*)::int` }).from(customers),
          { label: 'home:stat-customers' },
        ).then((r) => Number(r[0]?.count ?? 0)),
      ]);

    return {
      totalHeroes: heroesCount,
      activeQuests: questsCount,
      totalVictories: victoriesCount,
      totalCustomers: customersCount,
    };
  } catch (e) {
    console.error('[home] stats failed:', (e as Error).message);
    return empty;
  }
}