/**
 * Seeds a fresh database with the demo building, so the app has something to
 * show before any real structure is entered through the admin panel.
 *
 * Safe to re-run: it does nothing if buildings already exist.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "../src/db/schema";
import { hashPassword } from "../src/server/auth/password";

const CREDENTIALS = {
  admin: { login: "admin", password: "admin2026" },
  markaziy: { login: "markaziy", password: "markaziy2026" },
  korpus: { login: "korpus", password: "korpus2026" },
};

interface RoomSeed {
  name: string;
  sensors: { name: string; externalId: string }[];
}
interface DeptSeed {
  name: string;
  rooms: RoomSeed[];
}
interface FloorSeed {
  name: string;
  level: number;
  departments: DeptSeed[];
}

const MARKAZIY: FloorSeed[] = [
  {
    name: "1-qavat",
    level: 1,
    departments: [
      {
        name: "Qabulxona",
        rooms: [
          { name: "Qabulxona", sensors: [{ name: "Qabulxona", externalId: "mock-01" }] },
          { name: "Yig'ilish zali", sensors: [{ name: "Yig'ilish zali", externalId: "mock-02" }] },
        ],
      },
      {
        name: "Laboratoriya",
        rooms: [
          {
            name: "Tahlil xonasi",
            sensors: [
              { name: "Tahlil xonasi", externalId: "mock-03" },
              { name: "Tahlil xonasi 2", externalId: "mock-04" },
            ],
          },
          { name: "Reagent xonasi", sensors: [{ name: "Reagent xonasi", externalId: "mock-05" }] },
          { name: "Sovutgich bo'limi", sensors: [{ name: "Sovutgich bo'limi", externalId: "mock-06" }] },
        ],
      },
    ],
  },
  {
    name: "2-qavat",
    level: 2,
    departments: [
      {
        name: "Ma'muriyat",
        rooms: [
          { name: "1-kabinet", sensors: [{ name: "1-kabinet", externalId: "mock-07" }] },
          { name: "2-kabinet", sensors: [{ name: "2-kabinet", externalId: "mock-08" }] },
        ],
      },
      {
        name: "Arxiv",
        rooms: [
          {
            name: "Arxiv xonasi",
            sensors: [
              { name: "Arxiv xonasi", externalId: "mock-09" },
              { name: "Arxiv xonasi 2", externalId: "mock-10" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "3-qavat",
    level: 3,
    departments: [
      {
        name: "Server xonasi",
        rooms: [
          {
            name: "Server zali",
            sensors: [
              { name: "Server zali", externalId: "mock-11" },
              { name: "Server zali 2", externalId: "mock-12" },
            ],
          },
          { name: "UPS xonasi", sensors: [{ name: "UPS xonasi", externalId: "mock-13" }] },
        ],
      },
    ],
  },
];

const KORPUS: FloorSeed[] = [
  {
    name: "1-qavat",
    level: 1,
    departments: [
      {
        name: "Ombor",
        rooms: [
          {
            name: "Asosiy ombor",
            sensors: [
              { name: "Asosiy ombor", externalId: "mock-14" },
              { name: "Asosiy ombor 2", externalId: "mock-15" },
            ],
          },
          { name: "Sovuq ombor", sensors: [{ name: "Sovuq ombor", externalId: "mock-16" }] },
        ],
      },
      {
        name: "Yuklash",
        rooms: [{ name: "Yuklash zonasi", sensors: [{ name: "Yuklash zonasi", externalId: "mock-17" }] }],
      },
    ],
  },
  {
    name: "2-qavat",
    level: 2,
    departments: [
      {
        name: "Ishlab chiqarish",
        rooms: [
          {
            name: "Sex A",
            sensors: [
              { name: "Sex A", externalId: "mock-18" },
              { name: "Sex A 2", externalId: "mock-19" },
            ],
          },
          { name: "Sex B", sensors: [{ name: "Sex B", externalId: "mock-20" }] },
        ],
      },
    ],
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  const existing = await db.select({ id: schema.buildings.id }).from(schema.buildings).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded — nothing to do.");
    await pool.end();
    return;
  }

  await db.insert(schema.admins).values({
    login: CREDENTIALS.admin.login,
    passwordHash: await hashPassword(CREDENTIALS.admin.password),
  });

  await seedBuilding(db, "Markaziy bino", "markaziy", CREDENTIALS.markaziy, MARKAZIY);
  await seedBuilding(db, "Ishlab chiqarish korpusi", "korpus", CREDENTIALS.korpus, KORPUS);

  console.log("Seeded 1 admin, 2 buildings, 5 floors, 8 departments, 15 rooms, 20 sensors.");
  await pool.end();
}

async function seedBuilding(
  db: ReturnType<typeof drizzle<typeof schema>>,
  name: string,
  slug: string,
  credential: { login: string; password: string },
  plan: FloorSeed[],
) {
  const [building] = await db
    .insert(schema.buildings)
    .values({
      slug,
      name,
      login: credential.login,
      passwordHash: await hashPassword(credential.password),
    })
    .returning();

  for (const floorSeed of plan) {
    const [floor] = await db
      .insert(schema.floors)
      .values({ buildingId: building.id, name: floorSeed.name, level: floorSeed.level })
      .returning();

    for (const [d, deptSeed] of floorSeed.departments.entries()) {
      const [dept] = await db
        .insert(schema.departments)
        .values({
          buildingId: building.id,
          floorId: floor.id,
          name: deptSeed.name,
          sortOrder: d,
        })
        .returning();

      for (const [r, roomSeed] of deptSeed.rooms.entries()) {
        const [room] = await db
          .insert(schema.rooms)
          .values({ departmentId: dept.id, name: roomSeed.name, sortOrder: r })
          .returning();

        for (const sensorSeed of roomSeed.sensors) {
          await db.insert(schema.sensors).values({
            buildingId: building.id,
            roomId: room.id,
            externalId: sensorSeed.externalId,
            name: sensorSeed.name,
            provider: "mock",
          });
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
