import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function cleanup() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle(sqlClient);

  const results: Record<string, number> = {};

  {
    const r = await db.execute(sql`
      DELETE FROM sessions WHERE expires_at < now()
    `);
    results.sessions = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM customer_sessions WHERE expires_at < now()
    `);
    results.customerSessions = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM email_verifications WHERE expires_at < now()
    `);
    results.emailVerifications = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM rate_limits WHERE updated_at < now() - interval '1 day'
    `);
    results.rateLimits = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM ai_review_cache WHERE created_at < now() - interval '90 days'
    `);
    results.aiReviewCache = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM ai_usage WHERE created_at < now() - interval '180 days'
    `);
    results.aiUsage = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM password_resets WHERE expires_at < now() OR used_at IS NOT NULL
    `);
    results.passwordResets = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM page_views WHERE created_at < now() - interval '90 days'
    `);
    results.pageViews = (r as unknown as { count?: number }).count ?? 0;
  }

  {
    const r = await db.execute(sql`
      DELETE FROM banned_ips WHERE expires_at IS NOT NULL AND expires_at < now()
    `);
    results.bannedIps = (r as unknown as { count?: number }).count ?? 0;
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