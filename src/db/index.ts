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

type Db = ReturnType<typeof drizzle<typeof schema>>;

let instance: Db | undefined;

function real(): Db {
  if (!instance) instance = drizzle(pool(), { schema });
  return instance;
}

/**
 * Lazy on purpose: the pool is built on FIRST USE, not on import.
 *
 * `next build` imports every route module to read its configuration, and it
 * does that with no database in reach — inside the Docker build there is not
 * even a container running yet. Connecting at module scope turned that into
 * "Failed to collect page data", which names the page and never mentions the
 * real cause. Importing this module must stay free of side effects.
 */
export const db = new Proxy({} as Db, {
  get(_target, property) {
    const source = real() as unknown as Record<string | symbol, unknown>;
    const value = source[property];
    // Methods must keep their `this`, or drizzle loses its own internals.
    return typeof value === "function" ? value.bind(source) : value;
  },
});

export { schema };
