import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/customer-auth';
import { QuestForm } from '@/components/QuestForm';

export const dynamic = 'force-dynamic';

export default async function NewQuestPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/employer/login');

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/employer"
          className="text-sm text-zinc-500 hover:text-amber-400"
        >
          ← В кабинет
        </Link>

        <h1 className="text-3xl font-bold mt-6 mb-2">Новый квест</h1>
        <p className="text-zinc-400 mb-8">
          Опишите задачу. Платформа проверит сдачу по фазам, которые вы зададите.
        </p>

        <QuestForm mode="create" />
      </div>
    </main>
  );
}