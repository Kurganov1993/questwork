import { logger } from './logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() ?? '';
const FROM = process.env.EMAIL_FROM ?? 'noreply@questwork.app';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Отправляет письмо через Resend. Если ключа нет — пишет ссылку в лог.
 * Никогда не бросает.
 */
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

/**
 * Шаблон письма подтверждения email.
 */
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