import { headers } from 'next/headers';
import { checkRateLimit } from './rate-limit';

export async function checkPublicRateLimit(
  bucket: 'publicProfile',
): Promise<boolean> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : h.get('x-real-ip') ?? 'unknown';

    const rl = await checkRateLimit(bucket, `ip:${ip}`);
    return rl.allowed;
  } catch {
    return true;
  }
}