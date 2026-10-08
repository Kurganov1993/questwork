import Link from 'next/link';
import { LEGAL } from '@/lib/legal-config';
import { HeroBackground } from '@/components/home/HeroBackground';

export const metadata = {
  title: `О проекте · ${LEGAL.platformName}`,
  description:
    'QuestWork — платформа, где найм превращён в рейд: сдаёшь GitHub-репозиторий, проходишь проверку в Docker и AI-ревью, побеждаешь босса.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden">
        <HeroBackground />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-20">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← На главную
          </Link>

          <h1 className="text-4xl sm:text-5xl font-bold mt-6 mb-6">
            О <span className="text-gradient-amber">QuestWork</span>
          </h1>

          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-zinc-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-relaxed [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:text-zinc-400 [&_a]:text-amber-400">
            <p className="text-lg text-zinc-400">
              Обычный найм сломан. Резюме ничего не значат, отклики уходят в
              пустоту, а HR-боты отправляют отказы быстрее, чем ты успел
              отправить письмо.
            </p>

            <p>
              QuestWork превращает проверку кода в игру. Разработчик создаёт
              героя, выбирает класс, берёт квест — реальную задачу с критериями
              приёмки. Сдаёт GitHub-репозиторий. Платформа собирает его в
              Docker, прогоняет тесты, читает код через ESLint, Semgrep и AI.
              Каждая проверка — это удар по боссу. Победа — новые артефакты,
              уровни, достижения.
            </p>

            <h2>Что происходит при сдаче квеста</h2>
            <ul>
              <li>
                <strong>Репозиторий</strong> — платформа тянет код через GitHub
                API, проверяет структуру, README, коммиты.
              </li>
              <li>
                <strong>Docker</strong> — реальная сборка проекта в изолированном
                контейнере: <code>npm install && npm run build</code>.
              </li>
              <li>
                <strong>Тесты</strong> — <code>npm test</code> в том же
                контейнере. Реальный прогон, не эвристика.
              </li>
              <li>
                <strong>ESLint и Semgrep</strong> — статический анализ: стиль,
                баги, уязвимости, хардкод секретов.
              </li>
              <li>
                <strong>AI-ревью</strong> — языковая модель читает код и даёт
                осмысленные замечания по архитектуре и обработке ошибок.
              </li>
            </ul>

            <h2>Для разработчиков</h2>
            <p>
              Твой профиль — не PDF-резюме, а живой персонаж с артефактами и
              достижениями. Каждая победа подтверждена реальной проверкой
              кода. Ссылку на профиль можно отправить в HR — там видно не
              «уверенное владение React», а пройденные квесты и оценки от
              AI-ревью.
            </p>

            <h2>Для работодателей</h2>
            <p>
              Публикуй квесты — реальные задачи с проверяемыми критериями.
              Получай сдачи от героев, отслеживай статусы найма (шортлист,
              интервью, нанят). Смотри публичные профили без логина. Не нужно
              читать сотни резюме — все доказательства уже собраны.
            </p>

            <h2>Кто мы</h2>
            <p>
              Проект делает {LEGAL.operator.name} ({LEGAL.operator.status}).
              Это независимая разработка, не связанная с крупными компаниями.
              Мы в стадии беты: возможны сбои, потеря данных, изменения правил.
            </p>

            <h2>Технологии</h2>
            <ul>
              <li>Next.js 15, TypeScript, Tailwind CSS</li>
              <li>PostgreSQL (Neon) + Drizzle ORM</li>
              <li>Docker для изоляции сборки и тестов</li>
              <li>ESLint, Semgrep — статический анализ</li>
              <li>AI-ревью через ZvenoAI (OpenAI-совместимый API)</li>
              <li>GitHub OAuth для доступа к репозиториям</li>
            </ul>

            <h2>Открытость</h2>
            <p>
              Мы верим, что честная проверка кода важнее красивых слов. Если
              у тебя есть идеи, замечания или предложения — напиши нам.
            </p>

            <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4 text-xs">
              <a
                href={`mailto:${LEGAL.operator.email}`}
                className="text-amber-400 hover:text-amber-300"
              >
                {LEGAL.operator.email}
              </a>
              <span className="text-zinc-700">·</span>
              <Link
                href="/contact"
                className="text-amber-400 hover:text-amber-300"
              >
                Форма связи
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}