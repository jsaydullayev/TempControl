import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

/**
 * One pool per process. Next.js dev reloads modules on every edit, so the pool
 * is parked on globalThis — otherwise each save leaks a fresh set of
 * connections until Postgres refuses new ones.
 */
const globalForDb = globalThis as unknown as { tcPool?: Pool };

function pool(): Pool {
  if (!globalForDb.tcPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — copy .env.example to .env.local");
    }
    globalForDb.tcPool = new Pool({ connectionString, max: 10 });
  }
  return globalForDb.tcPool;
}

export const db = drizzle(pool(), { schema });
export { schema };
