import { logger } from './logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() ?? '';
const FROM = process.env.EMAIL_FROM ?? 'noreply@questwork.app';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!RESEND_API_KEY) {
    logger.warn('email.skipped', {
      to: input.to,
      subject: input.subject,
      reason: 'RESEND_API_KEY не задан',
    });
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('email.failed', {
        to: input.to,
        status: res.status,
        body: body.slice(0, 200),
      });
      return false;
    }

    logger.info('email.sent', { to: input.to, subject: input.subject });
    return true;
  } catch (e) {
    logger.error('email.error', {
      to: input.to,
      message: (e as Error).message,
    });
    return false;
  }
}

export function verificationEmailHtml(
  companyName: string,
  verifyUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 32px;">⚔️</div>
      <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px; margin-top: 8px; color: #fbbf24;">QUESTWORK</div>
    </div>
    <h1 style="font-size: 22px; margin: 0 0 16px;">Подтвердите email</h1>
    <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 24px;">
      Вы зарегистрировали компанию <strong style="color: #e5e5e5;">${companyName}</strong> на QuestWork. Чтобы активировать аккаунт, подтвердите email.
    </p>
    <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; background: #fbbf24; color: #000; text-decoration: none; font-weight: 600; border-radius: 10px;">
      Подтвердить email
    </a>
    <p style="color: #71717a; font-size: 12px; margin: 24px 0 0;">
      Или скопируйте ссылку:<br>
      <span style="color: #a1a1aa; word-break: break-all;">${verifyUrl}</span>
    </p>
    <p style="color: #71717a; font-size: 12px; margin: 16px 0 0;">
      Ссылка действует 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.
    </p>
  </div>
</body>
</html>
  `.trim();
}

export function invitationEmailHtml(input: {
  heroNickname: string;
  companyName: string;
  questTitle: string;
  questSlug: string;
  status: 'shortlisted' | 'interview' | 'hired' | 'rejected';
  note: string | null;
  baseUrl: string;
}): string {
  const { heroNickname, companyName, questTitle, questSlug, status, note, baseUrl } = input;

  const statusMap = {
    shortlisted: { emoji: '📋', label: 'В шортлисте', color: '#3b82f6' },
    interview: { emoji: '📞', label: 'Приглашают на интервью', color: '#fbbf24' },
    hired: { emoji: '🎉', label: 'Наняли', color: '#10b981' },
    rejected: { emoji: '📭', label: 'Отказ', color: '#ef4444' },
  };

  const meta = statusMap[status];
  const questUrl = `${baseUrl}/quests/${questSlug}`;
  const invitationsUrl = `${baseUrl}/hero/invitations`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 32px;">⚔️</div>
      <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px; margin-top: 8px; color: #fbbf24;">QUESTWORK</div>
    </div>
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 40px; margin-bottom: 8px;">${meta.emoji}</div>
      <div style="display: inline-block; padding: 6px 14px; background: ${meta.color}22; color: ${meta.color}; border-radius: 8px; font-size: 13px; font-weight: 600;">
        ${meta.label}
      </div>
    </div>
    <h1 style="font-size: 22px; margin: 16px 0 12px; text-align: center;">Привет, ${heroNickname}!</h1>
    <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 20px; text-align: center;">
      Компания <strong style="color: #e5e5e5;">${companyName}</strong> отметила твою сдачу квеста <strong style="color: #e5e5e5;">«${questTitle}»</strong>.
    </p>
    ${
      note
        ? `<div style="background: #0a0a0a; border-left: 3px solid ${meta.color}; padding: 12px 16px; margin: 16px 0; border-radius: 6px;">
             <div style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Заметка от работодателя</div>
             <div style="color: #e5e5e5; font-style: italic;">«${note}»</div>
           </div>`
        : ''
    }
    <div style="text-align: center; margin: 28px 0;">
      <a href="${invitationsUrl}" style="display: inline-block; padding: 14px 28px; background: #fbbf24; color: #000; text-decoration: none; font-weight: 600; border-radius: 10px;">
        Открыть приглашение →
      </a>
    </div>
    <p style="color: #71717a; font-size: 12px; text-align: center; margin: 20px 0 0;">
      Все решения работодателей: <a href="${invitationsUrl}" style="color: #a1a1aa;">${invitationsUrl}</a><br>
      Квест: <a href="${questUrl}" style="color: #a1a1aa;">${questUrl}</a>
    </p>
    <div style="text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #27272a;">
      <a href="${baseUrl}/hero/settings" style="color: #71717a; font-size: 11px; text-decoration: underline;">
        Отключить уведомления
      </a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function resetPasswordEmailHtml(input: {
  name: string;
  resetUrl: string;
  isCustomer: boolean;
}): string {
  const { name, resetUrl, isCustomer } = input;
  const role = isCustomer ? 'компании' : 'героя';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 32px;">🔑</div>
      <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px; margin-top: 8px; color: #fbbf24;">QUESTWORK</div>
    </div>
    <h1 style="font-size: 22px; margin: 0 0 16px;">Сброс пароля</h1>
    <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 24px;">
      Привет, <strong style="color: #e5e5e5;">${name}</strong>. Кто-то запросил сброс пароля для аккаунта ${role} на QuestWork.
      Если это были не вы — просто проигнорируйте это письмо, пароль останется прежним.
    </p>
    <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background: #fbbf24; color: #000; text-decoration: none; font-weight: 600; border-radius: 10px;">
      Сбросить пароль
    </a>
    <p style="color: #71717a; font-size: 12px; margin: 24px 0 0;">
      Или скопируйте ссылку:<br>
      <span style="color: #a1a1aa; word-break: break-all;">${resetUrl}</span>
    </p>
    <p style="color: #71717a; font-size: 12px; margin: 16px 0 0;">
      Ссылка действует 1 час.
    </p>
  </div>
</body>
</html>
  `.trim();
}

export function submissionEmailHtml(input: {
  companyName: string;
  heroNickname: string;
  questTitle: string;
  questSlug: string;
  status: 'victory' | 'defeat';
  damageDealt: number;
  bossMaxHp: number;
  baseUrl: string;
}): string {
  const {
    companyName,
    heroNickname,
    questTitle,
    questSlug,
    status,
    damageDealt,
    bossMaxHp,
    baseUrl,
  } = input;

  const victory = status === 'victory';
  const pct = Math.round((damageDealt / bossMaxHp) * 100);
  const color = victory ? '#10b981' : '#ef4444';
  const label = victory ? 'Победа' : 'Поражение';
  const emoji = victory ? '🏆' : '⚔️';

  const submissionUrl = `${baseUrl}/employer/quests`;
  const publicProfileUrl = `${baseUrl}/u/${heroNickname}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 32px;">${emoji}</div>
      <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px; margin-top: 8px; color: #fbbf24;">QUESTWORK</div>
    </div>
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; padding: 6px 14px; background: ${color}22; color: ${color}; border-radius: 8px; font-size: 13px; font-weight: 600;">
        ${label} · ${pct}% урона
      </div>
    </div>
    <h1 style="font-size: 22px; margin: 16px 0 12px; text-align: center;">Новая сдача</h1>
    <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 20px; text-align: center;">
      <strong style="color: #e5e5e5;">${heroNickname}</strong> сдал квест <strong style="color: #e5e5e5;">«${questTitle}»</strong> компании ${companyName}.
    </p>
    <div style="background: #0a0a0a; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="color: #71717a; padding: 4px 0;">Результат</td>
          <td style="color: ${color}; text-align: right; font-weight: 600;">${label}</td>
        </tr>
        <tr>
          <td style="color: #71717a; padding: 4px 0;">Урон</td>
          <td style="color: #e5e5e5; text-align: right; font-family: monospace;">${damageDealt} / ${bossMaxHp}</td>
        </tr>
        <tr>
          <td style="color: #71717a; padding: 4px 0;">Герой</td>
          <td style="text-align: right;"><a href="${publicProfileUrl}" style="color: #a78bfa;">${heroNickname}</a></td>
        </tr>
      </table>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${submissionUrl}" style="display: inline-block; padding: 14px 28px; background: #fbbf24; color: #000; text-decoration: none; font-weight: 600; border-radius: 10px;">
        Открыть кабинет →
      </a>
    </div>
    <p style="color: #71717a; font-size: 12px; text-align: center; margin: 20px 0 0;">
      Квест: <a href="${baseUrl}/quests/${questSlug}" style="color: #a1a1aa;">${baseUrl}/quests/${questSlug}</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}