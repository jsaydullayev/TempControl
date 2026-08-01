/**
 * Creates a minimal structure and binds the first unbound provider device to it,
 * so the whole chain — provider → poller → database → UI — can be verified on a
 * fresh install without clicking through the admin panel.
 *
 *   tsx --env-file=.env.local scripts/bind-first-device.ts
 *
 * Names are placeholders; rename them in /admin/structure afterwards.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";

import * as schema from "../src/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { getProvider } from "../src/server/providers";

const BUILDING = { name: "Sinov binosi", slug: "sinov", login: "sinov", password: "sinov2026" };
const FLOOR = "1-qavat";
const DEPARTMENT = "Sinov bo'limi";
const ROOM = "Sinov xonasi";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  // 1. Building
  let [building] = await db
    .select()
    .from(schema.buildings)
    .where(eq(schema.buildings.login, BUILDING.login))
    .limit(1);

  if (!building) {
    [building] = await db
      .insert(schema.buildings)
      .values({
        name: BUILDING.name,
        slug: BUILDING.slug,
        login: BUILDING.login,
        passwordHash: await hashPassword(BUILDING.password),
      })
      .returning();
    console.log(`Building created: ${BUILDING.name}  (login ${BUILDING.login} / ${BUILDING.password})`);
  }

  // 2. Floor
  let [floor] = await db
    .select()
    .from(schema.floors)
    .where(eq(schema.floors.buildingId, building.id))
    .limit(1);
  if (!floor) {
    [floor] = await db
      .insert(schema.floors)
      .values({ buildingId: building.id, name: FLOOR, level: 1 })
      .returning();
    console.log(`Floor created: ${FLOOR}`);
  }

  // 3. Department
  let [department] = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.floorId, floor.id))
    .limit(1);
  if (!department) {
    [department] = await db
      .insert(schema.departments)
      .values({ buildingId: building.id, floorId: floor.id, name: DEPARTMENT })
      .returning();
    console.log(`Department created: ${DEPARTMENT}`);
  }

  // 4. Room
  let [room] = await db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.departmentId, department.id))
    .limit(1);
  if (!room) {
    [room] = await db
      .insert(schema.rooms)
      .values({ departmentId: department.id, name: ROOM })
      .returning();
    console.log(`Room created: ${ROOM}`);
  }

  // 5. Bind every device the provider reports that is not already active.
  const devices = await getProvider().listDevices();
  const known = await db
    .select({ externalId: schema.sensors.externalId })
    .from(schema.sensors)
    .where(eq(schema.sensors.isActive, true));
  const taken = new Set(known.map((k) => k.externalId));

  const unbound = devices.filter((d) => !taken.has(d.externalId));
  if (unbound.length === 0) {
    console.log("Every device is already bound.");
  }

  for (const device of unbound) {
    // Same naming rule the admin panel uses: the room name, numbered on collision.
    const siblings = await db
      .select({ id: schema.sensors.id })
      .from(schema.sensors)
      .where(and(eq(schema.sensors.roomId, room.id), eq(schema.sensors.isActive, true)));
    const name = siblings.length === 0 ? room.name : `${room.name} ${siblings.length + 1}`;

    const [existing] = await db
      .select({ id: schema.sensors.id })
      .from(schema.sensors)
      .where(eq(schema.sensors.externalId, device.externalId))
      .limit(1);

    const values = {
      buildingId: building.id,
      roomId: room.id,
      name,
      provider: getProvider().name,
      isActive: true,
    };

    if (existing) {
      await db.update(schema.sensors).set(values).where(eq(schema.sensors.id, existing.id));
    } else {
      await db.insert(schema.sensors).values({ ...values, externalId: device.externalId });
    }
    console.log(`Bound ${device.externalId} → ${name}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
