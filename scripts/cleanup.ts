import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function cleanup() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle(sqlClient);

  const results: Record<string, number> = {};

  // 1. Истёкшие сессии героев
  {
    const r = await db.execute(sql`
      DELETE FROM sessions WHERE expires_at < now()
    `);
    results.sessions = (r as unknown as { count?: number }).count ?? 0;
  }

  // 2. Истёкшие сессии работодателей
  {
    const r = await db.execute(sql`
      DELETE FROM customer_sessions WHERE expires_at < now()
    `);
    results.customerSessions = (r as unknown as { count?: number }).count ?? 0;
  }

  // 3. Истёкшие токены верификации email
  {
    const r = await db.execute(sql`
      DELETE FROM email_verifications WHERE expires_at < now()
    `);
    results.emailVerifications =
      (r as unknown as { count?: number }).count ?? 0;
  }

  // 4. Rate limits старше 1 дня
  {
    const r = await db.execute(sql`
      DELETE FROM rate_limits WHERE updated_at < now() - interval '1 day'
    `);
    results.rateLimits = (r as unknown as { count?: number }).count ?? 0;
  }

  // 5. AI review cache старше 90 дней
  {
    const r = await db.execute(sql`
      DELETE FROM ai_review_cache WHERE created_at < now() - interval '90 days'
    `);
    results.aiReviewCache = (r as unknown as { count?: number }).count ?? 0;
  }

  // 6. AI usage старше 180 дней
  {
    const r = await db.execute(sql`
      DELETE FROM ai_usage WHERE created_at < now() - interval '180 days'
    `);
    results.aiUsage = (r as unknown as { count?: number }).count ?? 0;
  }

  // 7. Истёкшие токены сброса пароля и использованные
  {
    const r = await db.execute(sql`
      DELETE FROM password_resets
      WHERE expires_at < now() OR used_at IS NOT NULL
    `);
    results.passwordResets = (r as unknown as { count?: number }).count ?? 0;
  }

  console.log('=== Cleanup result ===');
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('✅ Cleanup done.');
}

cleanup().catch((e) => {
  console.error('Cleanup failed:', e);
  process.exit(1);
});