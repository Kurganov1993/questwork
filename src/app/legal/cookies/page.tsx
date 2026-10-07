import Link from 'next/link';
import { LEGAL } from '@/lib/legal-config';
import { HeroBackground } from '@/components/home/HeroBackground';

export const metadata = {
  title: `Политика cookie · ${LEGAL.platformName}`,
  description: 'Какие cookie использует платформа QuestWork и зачем.',
};

export default function CookiesPage() {
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

          <h1 className="text-3xl sm:text-4xl font-bold mt-6 mb-3">
            Политика использования cookie
          </h1>
          <p className="text-sm text-zinc-500 mb-10">
            Редакция от {LEGAL.updatedAt}
          </p>

          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-zinc-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-relaxed [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_li]:text-zinc-400 [&_a]:text-amber-400 [&_a:hover]:text-amber-300 [&_strong]:text-zinc-200">
            <h2>1. Что такое cookie</h2>
            <p>
              Cookie — это небольшие текстовые файлы, которые сохраняются в
              вашем браузере при посещении сайта. Они позволяют сайту
              запоминать ваши действия и предпочтения в течение определённого
              времени.
            </p>

            <h2>2. Какие cookie мы используем</h2>
            <p>
              Мы используем только <strong>строго необходимые</strong> cookie.
              Они нужны для базовой работы Платформы, и без них сайт не будет
              функционировать корректно.
            </p>

            <h3>2.1. Строго необходимые cookie</h3>
            <ul>
              <li>
                <strong>qw_session</strong> — идентификатор вашей сессии на
                Платформе. Позволяет оставаться авторизованным между
                переходами по страницам. Хранится 30 дней, удаляется при
                выходе из аккаунта.
              </li>
              <li>
                <strong>qw_employer_session</strong> — то же для аккаунта
                работодателя.
              </li>
              <li>
                <strong>qw_gh_state</strong> — временный токен защиты от CSRF
                при подключении GitHub. Удаляется автоматически через 10
                минут.
              </li>
            </ul>

            <h3>2.2. Аналитические cookie</h3>
            <p>
              На данный момент мы <strong>не используем</strong> аналитические
              cookie (Google Analytics, Яндекс.Метрика и аналогичные). Если в
              будущем мы их добавим — обновим эту политику и запросим ваше
              отдельное согласие через cookie-баннер.
            </p>

            <h2>3. Управление cookie</h2>
            <p>
              3.1. Вы можете управлять cookie через настройки браузера.
              Большинство браузеров позволяют блокировать или удалять cookie.
              Однако блокировка строго необходимых cookie приведёт к
              неработоспособности Платформы — вы не сможете авторизоваться.
            </p>
            <p>
              3.2. Отозвать согласие на использование cookie вы можете в любой
              момент, очистив cookie в браузере. Для этого:
            </p>
            <ul>
              <li>
                <strong>Chrome:</strong> Настройки → Конфиденциальность и
                безопасность → Файлы cookie и другие данные сайтов.
              </li>
              <li>
                <strong>Firefox:</strong> Настройки → Приватность и защита →
                Куки и данные сайтов.
              </li>
              <li>
                <strong>Safari:</strong> Настройки → Конфиденциальность →
                Управление данными сайта.
              </li>
            </ul>

            <h2>4. Согласие</h2>
            <p>
              4.1. Используя Платформу, вы соглашаетесь с использованием
              строго необходимых cookie, описанных выше. Это необходимо для
              работы сервиса.
            </p>
            <p>
              4.2. Для использования любых дополнительных cookie (аналитика,
              реклама) мы будем запрашивать ваше отдельное активное согласие
              через баннер.
            </p>

            <h2>5. Контакты</h2>
            <p>
              Оператор: {LEGAL.operator.name} ({LEGAL.operator.status})
              <br />
              По вопросам использования cookie:{' '}
              <a href={`mailto:${LEGAL.operator.email}`}>
                {LEGAL.operator.email}
              </a>
            </p>
          </div>

          <div className="mt-12 pt-6 border-t border-white/5 text-xs text-zinc-600">
            <div className="flex gap-4 flex-wrap">
              <Link
                href="/legal/privacy"
                className="hover:text-amber-400 transition"
              >
                Политика конфиденциальности
              </Link>
              <Link
                href="/legal/terms"
                className="hover:text-amber-400 transition"
              >
                Пользовательское соглашение
              </Link>
              <Link
                href="/legal/cookies"
                className="hover:text-amber-400 transition"
              >
                Политика cookie
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}