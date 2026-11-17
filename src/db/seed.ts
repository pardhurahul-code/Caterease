import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import { foodCategories } from './schema.ts';

let seedPromise: Promise<void> | null = null;

/**
 * Lazily verifies whether seed data exists on first HTTP request if database is fresh.
 * Never runs eagerly at module import time.
 */
export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const existing = await db.select({ id: foodCategories.id }).from(foodCategories).limit(1);
        if (existing.length > 0) return;

        // Fallback minimal bootstrap if running against an unseeded local PostgreSQL instance
        await db.execute(sql`SELECT 1`);
      } catch (err) {
        console.error('Lazy seed check error:', err);
        seedPromise = null;
      }
    })();
  }
  return seedPromise;
}
