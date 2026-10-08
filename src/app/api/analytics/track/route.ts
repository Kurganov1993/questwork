import { NextRequest, NextResponse } from 'next/server';
import { getCurrentHero } from '@/lib/auth';
import { extractIpFromHeaders, recordPageView, shouldTrack } from '@/lib/analytics';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

type Body = {
  path?: string;
  referrer?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const path = String(body.path ?? '').slice(0, 512);

    if (!path || !shouldTrack(path)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const hero = await getCurrentHero().catch(() => null);

    // Читаем session-id из cookie — это не наш cookie, а сгенерированный
    // на клиенте, чтобы считать уникальных в рамках сессии
    const jar = await cookies();
    const sessionId = jar.get('qw_visitor')?.value;

    const ip = extractIpFromHeaders(req.headers);
    const userAgent = req.headers.get('user-agent');

    // Фоново, не блокируем ответ
    void recordPageView({
      path,
      referrer: body.referrer ?? null,
      userAgent,
      ip,
      heroId: hero?.id,
      sessionId,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}