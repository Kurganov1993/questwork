import Link from 'next/link';
import { LEGAL } from '@/lib/legal-config';
import { HeroBackground } from '@/components/home/HeroBackground';

export const metadata = {
  title: `Связь · ${LEGAL.platformName}`,
  description: 'Как связаться с командой QuestWork.',
};

export default function ContactPage() {
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

          <h1 className="text-4xl sm:text-5xl font-bold mt-6 mb-3">
            Связь
          </h1>
          <p className="text-zinc-400 mb-10 max-w-xl">
            Нашли баг, хотите предложить идею или задать вопрос? Мы отвечаем
            на все письма в течение 1–2 рабочих дней.
          </p>

          <div className="space-y-4">
            <ContactCard
              icon="✉️"
              title="Общие вопросы"
              text="Идеи, пожелания, замечания по UX."
              email={LEGAL.operator.email}
            />
            <ContactCard
              icon="⚖️"
              title="Юридические запросы"
              text="Персональные данные, авторские права, оферта."
              email={LEGAL.operator.legalEmail}
            />
            <ContactCard
              icon="🐞"
              title="Технические проблемы"
              text="Ошибки, сбои, проблемы с квестами или аккаунтом."
              email={LEGAL.operator.supportEmail}
            />
          </div>

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <div className="text-xs text-zinc-500 mb-3 tracking-widest">
              РЕКВИЗИТЫ
            </div>
            <div className="text-sm text-zinc-300">
              <div className="mb-1">
                <strong>{LEGAL.operator.name}</strong> ({LEGAL.operator.status})
              </div>
              <div className="text-zinc-500">
                Юридические реквизиты предоставляются по официальному запросу
                Роскомнадзора или суда.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ContactCard({
  icon,
  title,
  text,
  email,
}: {
  icon: string;
  title: string;
  text: string;
  email: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 flex items-start gap-4">
      <div className="text-3xl shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-sm text-zinc-500 mb-3">{text}</div>
        <a
          href={`mailto:${email}`}
          className="text-sm text-amber-400 hover:text-amber-300 font-mono break-all"
        >
          {email}
        </a>
      </div>
    </div>
  );
}