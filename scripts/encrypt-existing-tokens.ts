import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { githubAccounts } from '../src/db/schema';
import { encryptToken, isEncrypted } from '../src/lib/crypto';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    console.error('❌ TOKEN_ENCRYPTION_KEY не задан в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const rows = await db.select().from(githubAccounts);

  let encryptedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (isEncrypted(row.accessToken)) {
      skippedCount++;
      continue;
    }

    const encrypted = encryptToken(row.accessToken);

    await db
      .update(githubAccounts)
      .set({ accessToken: encrypted })
      .where(eq(githubAccounts.id, row.id));

    console.log(`✓ hero_id=${row.heroId} (@${row.githubUsername})`);
    encryptedCount++;
  }

  console.log('');
  console.log(`Зашифровано: ${encryptedCount}`);
  console.log(`Уже зашифровано: ${skippedCount}`);
  console.log(`Всего: ${rows.length}`);
}

migrate().catch((e) => {
  console.error('Ошибка миграции:', e);
  process.exit(1);
});