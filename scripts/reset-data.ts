/**
 * Wipes all tenant data — buildings and everything under them — and keeps the
 * admin account, so the panel stays reachable to build the real structure.
 *
 *   npm run db:reset
 *
 * DESTRUCTIVE. Requires CONFIRM=yes so it cannot run by accident.
 */
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  if (process.env.CONFIRM !== "yes") {
    console.error("Refusing to run without CONFIRM=yes — this deletes every building.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  const before = await counts(pool);
  console.log("Before:", before);

  // buildings cascades to floors → departments → rooms → sensors → readings/alerts.
  // thresholds carry a plain scope_id with no foreign key, so they go explicitly.
  await pool.query("delete from thresholds");
  await pool.query("delete from buildings");

  if (process.env.KEEP_AUDIT !== "yes") {
    await pool.query("delete from audit_log");
  }

  const after = await counts(pool);
  console.log("After: ", after);
  console.log(`Admins kept: ${after.admins}`);

  await pool.end();
}

async function counts(pool: Pool) {
  const tables = [
    "buildings",
    "floors",
    "departments",
    "rooms",
    "sensors",
    "readings",
    "alerts",
    "thresholds",
    "audit_log",
    "admins",
  ];
  const out: Record<string, number> = {};
  for (const table of tables) {
    const { rows } = await pool.query(`select count(*)::int as n from ${table}`);
    out[table] = rows[0].n;
  }
  return out;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
