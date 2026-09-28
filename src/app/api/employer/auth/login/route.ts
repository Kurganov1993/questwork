import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createCustomerSession, verifyPassword } from '@/lib/customer-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!email || !password)
      return NextResponse.json(
        { ok: false, error: 'Email и пароль обязательны' },
        { status: 400 },
      );

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email));

    if (!customer)
      return NextResponse.json(
        { ok: false, error: 'Неверный email или пароль' },
        { status: 401 },
      );

    const ok = await verifyPassword(password, customer.passwordHash);
    if (!ok)
      return NextResponse.json(
        { ok: false, error: 'Неверный email или пароль' },
        { status: 401 },
      );

    await createCustomerSession(customer.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[employer/login]', e);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}