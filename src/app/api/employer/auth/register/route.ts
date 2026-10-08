import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createCustomerSession,
  hashPassword,
  validateEmail,
  validateCompanyName,
  slugify,
} from '@/lib/customer-auth';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req);
    const rl = await checkRateLimit('employerAuth', identifier);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const companyName = String(body.companyName ?? '').trim();
    const acceptedTerms = body.acceptedTerms === true;

    if (!acceptedTerms) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Необходимо принять Пользовательское соглашение и Политику конфиденциальности',
        },
        { status: 400 },
      );
    }

    const emailErr = validateEmail(email);
    if (emailErr)
      return NextResponse.json({ ok: false, error: emailErr }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json(
        { ok: false, error: 'Пароль минимум 6 символов' },
        { status: 400 },
      );

    const nameErr = validateCompanyName(companyName);
    if (nameErr)
      return NextResponse.json({ ok: false, error: nameErr }, { status: 400 });

    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, email));
    if (existing)
      return NextResponse.json(
        { ok: false, error: 'Такой email уже зарегистрирован' },
        { status: 409 },
      );

    let slug = slugify(companyName) || 'company';
    let attempt = 0;
    while (attempt < 5) {
      const [taken] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.slug, slug));
      if (!taken) break;
      attempt++;
      slug = `${slugify(companyName) || 'company'}-${attempt + 1}`;
    }

    const passwordHash = await hashPassword(password);

    const [created] = await db
      .insert(customers)
      .values({
        email,
        passwordHash,
        companyName,
        slug,
        termsAcceptedAt: new Date(),
      })
      .returning();

    await createCustomerSession(created.id);

    return NextResponse.json({ ok: true, customer: { id: created.id, slug } });
  } catch (e) {
    console.error('[employer/register]', e);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}