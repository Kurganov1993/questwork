import { NextResponse } from 'next/server';
import { destroyCurrentSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  await destroyCurrentSession();
  return NextResponse.json({ ok: true });
}