'use client';

import { useState } from 'react';

export function HeroEmailSettings({
  initialEmail,
  initialVerified,
  initialNotify,
}: {
  initialEmail: string | null;
  initialVerified: boolean;
  initialNotify: boolean;
}) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [verified, setVerified] = useState(initialVerified);
  const [notify, setNotify] = useState(initialNotify);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    setDevUrl(null);
    try {
      const res = await fetch('/api/hero/settings/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          notifyByEmail: notify,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Не удалось сохранить');
        return;
      }
      setVerified(false);
      setMessage('Сохранено. Подтверди email, чтобы получать уведомления.');
    } catch {
      setError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  }

  async function sendVerification() {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/hero/settings/email/send-verification', {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Не удалось отправить письмо');
        return;
      }
      if (data.alreadyVerified) {
        setVerified(true);
        setMessage('Email уже подтверждён');
        return;
      }
      setMessage('Письмо отправлено — проверь почту.');
      if (data.verifyUrl) setDevUrl(data.verifyUrl);
    } catch {
      setError('Ошибка сети');
    } finally {
      setSending(false);
    }
  }

  async function toggleNotify(v: boolean) {
    setNotify(v);
    setSaving(true);
    try {
      await fetch('/api/hero/settings/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyByEmail: v }),
      });
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-6">
        <div className="font-semibold mb-1">Email для уведомлений</div>
        <div className="text-xs text-zinc-500 mb-4">
          Сюда будут приходить уведомления о приглашениях от работодателей.
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={saving}
            className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 focus:border-amber-500/60 outline-none text-sm font-mono"
          />

          <button
            onClick={save}
            disabled={saving || email.trim() === (initialEmail ?? '')}
            className="px-5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-medium hover:bg-amber-500/25 transition disabled:opacity-40"
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>

          {email.trim() && !verified && (
            <button
              onClick={sendVerification}
              disabled={sending}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm hover:border-amber-500/60 transition disabled:opacity-50"
            >
              {sending ? 'Отправляем…' : 'Подтвердить'}
            </button>
          )}

          {verified && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-700/40 text-emerald-300 text-sm flex items-center gap-2">
              ✓ Подтверждён
            </div>
          )}
        </div>

        {message && (
          <div className="mt-3 text-xs text-emerald-400">{message}</div>
        )}
        {error && (
          <div className="mt-3 text-xs text-red-400">{error}</div>
        )}
        {devUrl && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-xs text-zinc-500 mb-1">
              Dev-ссылка для верификации:
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

      <div className="glass rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold mb-1">Уведомления по email</div>
            <div className="text-xs text-zinc-500">
              Присылать письма о приглашениях от работодателей.
            </div>
          </div>

          <button
            onClick={() => toggleNotify(!notify)}
            className={`relative w-12 h-6 rounded-full transition ${
              notify ? 'bg-amber-500' : 'bg-white/10'
            }`}
            aria-label={notify ? 'Отключить уведомления' : 'Включить уведомления'}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                notify ? 'translate-x-[26px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}