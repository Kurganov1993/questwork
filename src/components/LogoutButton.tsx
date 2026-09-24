'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="text-xs text-zinc-500 hover:text-red-400 transition"
    >
      {loading ? '…' : 'Выйти'}
    </button>
  );
}