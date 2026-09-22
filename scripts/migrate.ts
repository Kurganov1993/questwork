import * as dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Миграции применены');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Ошибка миграции:', err);
  process.exit(1);
});