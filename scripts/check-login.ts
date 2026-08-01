/**
 * Verifies the login path against the database without a browser: the stored
 * hash for every seeded account, checked with the same scrypt helper the app
 * uses.
 *
 * It queries the tables directly rather than importing the auth module — that
 * one is marked `server-only` and belongs to the app process alone.
 *
 *   npm run check:login -- <login> <parol>
 *
 * The pair is passed in rather than hardcoded: seed passwords are generated
 * now, so a fixed list here could only ever be stale — or a published password.
 */
import { Pool } from "pg";

import { verifyPassword } from "../src/server/auth/password";

const [login, password] = process.argv.slice(2);

if (!login || !password) {
  console.error("Usage: npm run check:login -- <login> <parol>");
  process.exit(1);
}

// The wrong-password and unknown-login cases are derived, so a single pair
// still proves the whole path: accept, reject, and not-found.
const CASES: [string, string, boolean][] = [
  [login, password, true],
  [login, `${password}-wrong`, false],
  ["definitely-not-a-real-login", password, false],
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString });
  let failures = 0;

  for (const [login, password, expected] of CASES) {
    const building = await pool.query<{ id: string; password_hash: string }>(
      "select id, password_hash from buildings where login = $1 and is_active = true limit 1",
      [login],
    );
    const admin = building.rowCount
      ? { rowCount: 0, rows: [] as { password_hash: string }[] }
      : await pool.query<{ password_hash: string }>(
          "select password_hash from admins where login = $1 and is_active = true limit 1",
          [login],
        );

    const hash = building.rows[0]?.password_hash ?? admin.rows[0]?.password_hash;
    const ok = hash ? await verifyPassword(password, hash) : false;
    const pass = ok === expected;
    if (!pass) failures++;

    const kind = building.rowCount ? "building" : admin.rowCount ? "admin" : "—";
    console.log(
      `${pass ? "OK  " : "FAIL"}  ${login} / ${password}  → ${ok ? "accepted" : "rejected"}  (${kind})`,
    );
  }

  await pool.end();
  console.log(failures === 0 ? "\nLogin path is healthy." : `\n${failures} case(s) wrong.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
