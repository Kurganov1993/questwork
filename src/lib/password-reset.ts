import { randomBytes } from 'node:crypto';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { passwordResets, heroes, customers } from '@/db/schema';
import { withRetry } from './db-retry';
import { hashPassword } from './auth';
import { hashPassword as hashCustomerPassword } from './customer-auth';
import { logger } from './logger';

const TTL_MS = 60 * 60 * 1000; // 1 час

export type ResetSubject =
  | { kind: 'hero'; id: number; email: string; name: string }
  | { kind: 'customer'; id: number; email: string; name: string };

/**
 * Ищет, кому принадлежит email. Возвращает subject или null.
 */
export async function findSubjectByEmail(
  email: string,
): Promise<ResetSubject | null> {
  const normalized = email.trim().toLowerCase();

  const [hero] = await withRetry(
    () =>
      db
        .select({
          id: heroes.id,
          nickname: heroes.nickname,
          email: heroes.email,
        })
        .from(heroes)
        .where(eq(heroes.email, normalized)),
    { label: 'reset:find-hero' },
  );

  if (hero) {
    return {
      kind: 'hero',
      id: hero.id,
      email: normalized,
      name: hero.nickname,
    };
  }

  const [customer] = await withRetry(
    () =>
      db
        .select({
          id: customers.id,
          companyName: customers.companyName,
          email: customers.email,
        })
        .from(customers)
        .where(eq(customers.email, normalized)),
    { label: 'reset:find-customer' },
  );

  if (customer) {
    return {
      kind: 'customer',
      id: customer.id,
      email: normalized,
      name: customer.companyName,
    };
  }

  return null;
}

/**
 * Создаёт токен сброса пароля.
 */
export async function createResetToken(
  subject: ResetSubject,
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TTL_MS);

  await withRetry(
    () =>
      db.delete(passwordResets).where(
        subject.kind === 'hero'
          ? eq(passwordResets.heroId, subject.id)
          : eq(passwordResets.customerId, subject.id),
      ),
    { label: 'reset:clean-old' },
  );

  await withRetry(
    () =>
      db.insert(passwordResets).values({
        token,
        heroId: subject.kind === 'hero' ? subject.id : null,
        customerId: subject.kind === 'customer' ? subject.id : null,
        expiresAt,
      }),
    { label: 'reset:create-token' },
  );

  return token;
}

export type ResetValidation =
  | { ok: true; subject: ResetSubject }
  | { ok: false; reason: string };

/**
 * Проверяет токен сброса. Возвращает subject, если валиден.
 */
export async function validateResetToken(
  token: string,
): Promise<ResetValidation> {
  try {
    const [row] = await withRetry(
      () =>
        db
          .select()
          .from(passwordResets)
          .where(
            and(
              eq(passwordResets.token, token),
              gt(passwordResets.expiresAt, new Date()),
              isNull(passwordResets.usedAt),
            ),
          ),
        { label: 'reset:validate' },
    );

    if (!row) {
      return { ok: false, reason: 'Токен недействителен или истёк' };
    }

    if (row.heroId) {
      const [hero] = await db
        .select({
          id: heroes.id,
          nickname: heroes.nickname,
          email: heroes.email,
        })
        .from(heroes)
        .where(eq(heroes.id, row.heroId));

      if (!hero || !hero.email) {
        return { ok: false, reason: 'Аккаунт не найден' };
      }

      return {
        ok: true,
        subject: {
          kind: 'hero',
          id: hero.id,
          email: hero.email,
          name: hero.nickname,
        },
      };
    }

    if (row.customerId) {
      const [customer] = await db
        .select({
          id: customers.id,
          companyName: customers.companyName,
          email: customers.email,
        })
        .from(customers)
        .where(eq(customers.id, row.customerId));

      if (!customer) {
        return { ok: false, reason: 'Аккаунт не найден' };
      }

      return {
        ok: true,
        subject: {
          kind: 'customer',
          id: customer.id,
          email: customer.email,
          name: customer.companyName,
        },
      };
    }

    return { ok: false, reason: 'Токен повреждён' };
  } catch (e) {
    logger.error('reset:validate.failed', {
      message: (e as Error).message,
    });
    return { ok: false, reason: 'Ошибка проверки токена' };
  }
}

/**
 * Меняет пароль и помечает токен использованным.
 */
export async function applyPasswordReset(
  token: string,
  newPassword: string,
  subject: ResetSubject,
): Promise<boolean> {
  try {
    if (subject.kind === 'hero') {
      const hash = await hashPassword(newPassword);
      await withRetry(
        () =>
          db
            .update(heroes)
            .set({ passwordHash: hash })
            .where(eq(heroes.id, subject.id)),
        { label: 'reset:update-hero' },
      );
    } else {
      const hash = await hashCustomerPassword(newPassword);
      await withRetry(
        () =>
          db
            .update(customers)
            .set({ passwordHash: hash })
            .where(eq(customers.id, subject.id)),
        { label: 'reset:update-customer' },
      );
    }

    await withRetry(
      () =>
        db
          .update(passwordResets)
          .set({ usedAt: new Date() })
          .where(eq(passwordResets.token, token)),
      { label: 'reset:mark-used' },
    );

    logger.info('password.reset.applied', {
      kind: subject.kind,
      id: subject.id,
    });

    return true;
  } catch (e) {
    logger.error('reset:apply.failed', {
      message: (e as Error).message,
    });
    return false;
  }
}