/**
 * Creates (or re-passwords) the admin account — and nothing else.
 *
 *   ADMIN_LOGIN=admin ADMIN_PASSWORD='…' npx tsx scripts/create-admin.ts
 *
 * This exists because `seed.ts` was the only thing that created an admin, and
 * it also inserts two demo buildings with twenty fake sensors. On a real
 * install that is the wrong trade: you either seed demo data you must then
 * delete, or you have no way to log in at all.
 *
 * Safe to re-run: an existing login has its password reset, which is also the
 * recovery path when the admin password is lost.
 */
import { Pool } from "pg";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/** Same scheme as src/server/auth/password.ts — kept inline so the script has no app imports. */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const login = (process.env.ADMIN_LOGIN ?? "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 10) {
    console.error("ADMIN_PASSWORD is required and must be at least 10 characters.");
    console.error("Example: ADMIN_LOGIN=admin ADMIN_PASSWORD='...' npx tsx scripts/create-admin.ts");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const hash = await hashPassword(password);

  const { rows } = await pool.query(
    `insert into admins (login, password_hash)
     values ($1, $2)
     on conflict (login) do update set password_hash = excluded.password_hash, is_active = true
     returning login, (xmax = 0) as created`,
    [login, hash],
  );

  console.log(rows[0].created ? `Admin created: ${login}` : `Password reset for: ${login}`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
