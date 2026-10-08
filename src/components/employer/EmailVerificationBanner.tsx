'use client';

import { useState } from 'react';

export function EmailVerificationBanner() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  async function send() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/employer/auth/send-verification', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
        if (data.verifyUrl) {
          setDevUrl(data.verifyUrl);
        }
      } else {
        setError(data.error ?? 'Не удалось отправить письмо');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-emerald-300 mb-6">
        <div>✓ Письмо отправлено. Проверьте почту и перейдите по ссылке.</div>
        {devUrl && (
          <div className="mt-2 pt-2 border-t border-emerald-800/40">
            <div className="text-xs text-emerald-400/80 mb-1">
              Dev-ссылка (не отправлена по email):
            </div>
            <a
              href={devUrl}
              className="text-xs text-amber-300 hover:text-amber-200 underline break-all"
            >
              {devUrl}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 mb-6">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-xl shrink-0">✉️</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-amber-200 mb-1">
            Email не подтверждён
          </div>
          <div className="text-xs text-amber-200/70 mb-3">
            Подтвердите email, чтобы получать уведомления о новых сдачах и
            приглашениях.
          </div>
          <button
            onClick={send}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition disabled:opacity-50"
          >
            {loading ? 'Отправляем…' : 'Отправить письмо'}
          </button>
          {error && (
            <div className="mt-2 text-xs text-red-400">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}