import "server-only";

import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { departments, floors, readings, rooms, sensors } from "@/db/schema";
import { isOffline } from "@/lib/status";
import { requestNow } from "@/lib/now";
import { isUuid } from "@/lib/uuid";
import type { Department, Floor, Reading, Room, Sensor, SensorState } from "@/lib/types";
import { canSeeBuilding, type Session } from "@/server/auth/dal";
import { readingsInRange } from "@/server/ingest/poll";

/**
 * Scoped reads. Every exported function takes a Session first — that is the
 * mechanism that makes an unscoped query impossible to write by accident.
 */

const SPARK_WINDOW_MS = 3 * 60 * 60 * 1000;

/** A malformed id must be indistinguishable from a missing one. */
function requireUuid(value: string): string {
  if (!isUuid(value)) notFound();
  return value;
}

export async function listFloors(session: Session, buildingId: string): Promise<Floor[]> {
  requireUuid(buildingId);
  if (!canSeeBuilding(session, buildingId)) notFound();
  return db
    .select({ id: floors.id, buildingId: floors.buildingId, name: floors.name, level: floors.level })
    .from(floors)
    .where(and(eq(floors.buildingId, buildingId), eq(floors.isActive, true)))
    .orderBy(asc(floors.level));
}

export async function listDepartments(
  session: Session,
  buildingId: string,
  floorId?: string,
): Promise<Department[]> {
  requireUuid(buildingId);
  if (floorId) requireUuid(floorId);
  if (!canSeeBuilding(session, buildingId)) notFound();

  const where = floorId
    ? and(
        eq(departments.buildingId, buildingId),
        eq(departments.isActive, true),
        eq(departments.floorId, floorId),
      )
    : and(eq(departments.buildingId, buildingId), eq(departments.isActive, true));

  return db
    .select({
      id: departments.id,
      buildingId: departments.buildingId,
      floorId: departments.floorId,
      name: departments.name,
    })
    .from(departments)
    .where(where)
    .orderBy(asc(departments.sortOrder), asc(departments.name));
}

export async function listRooms(session: Session, departmentId: string): Promise<Room[]> {
  requireUuid(departmentId);
  const [dept] = await db
    .select({ buildingId: departments.buildingId })
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);

  if (!dept || !canSeeBuilding(session, dept.buildingId)) notFound();

  return db
    .select({ id: rooms.id, departmentId: rooms.departmentId, name: rooms.name })
    .from(rooms)
    .where(and(eq(rooms.departmentId, departmentId), eq(rooms.isActive, true)))
    .orderBy(asc(rooms.sortOrder), asc(rooms.name));
}

/**
 * Resolve a room id that came from the client.
 *
 * Filtering an already-scoped list is NOT enough: rendering the room's *name*
 * beside an empty table would disclose another building's structure. The id has
 * to be checked, and an out-of-scope room must 404 like a missing one.
 */
export async function getRoomInScope(session: Session, roomId: string): Promise<Room> {
  requireUuid(roomId);
  const [row] = await db
    .select({
      id: rooms.id,
      departmentId: rooms.departmentId,
      name: rooms.name,
      buildingId: departments.buildingId,
    })
    .from(rooms)
    .innerJoin(departments, eq(departments.id, rooms.departmentId))
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!row || !canSeeBuilding(session, row.buildingId)) notFound();
  return { id: row.id, departmentId: row.departmentId, name: row.name };
}

interface SensorFilter {
  floorId?: string;
  departmentId?: string;
  roomId?: string;
}

export async function listSensorStates(
  session: Session,
  buildingId: string,
  filter: SensorFilter = {},
): Promise<SensorState[]> {
  requireUuid(buildingId);
  if (!canSeeBuilding(session, buildingId)) notFound();

  const conditions = [eq(sensors.buildingId, buildingId), eq(sensors.isActive, true)];
  if (filter.roomId) conditions.push(eq(sensors.roomId, filter.roomId));
  if (filter.departmentId) conditions.push(eq(rooms.departmentId, filter.departmentId));
  if (filter.floorId) conditions.push(eq(departments.floorId, filter.floorId));

  const rows = await db
    .select({
      id: sensors.id,
      externalId: sensors.externalId,
      name: sensors.name,
      buildingId: sensors.buildingId,
      roomId: sensors.roomId,
      lastSeenAt: sensors.lastSeenAt,
    })
    .from(sensors)
    .innerJoin(rooms, eq(rooms.id, sensors.roomId))
    .innerJoin(departments, eq(departments.id, rooms.departmentId))
    .where(and(...conditions))
    .orderBy(asc(sensors.name));

  return buildStates(rows);
}

export async function getSensorState(session: Session, sensorId: string): Promise<SensorState> {
  requireUuid(sensorId);
  const [row] = await db
    .select({
      id: sensors.id,
      externalId: sensors.externalId,
      name: sensors.name,
      buildingId: sensors.buildingId,
      roomId: sensors.roomId,
      lastSeenAt: sensors.lastSeenAt,
    })
    .from(sensors)
    .where(and(eq(sensors.id, sensorId), eq(sensors.isActive, true)))
    .limit(1);

  // Unknown id and out-of-scope id are deliberately indistinguishable.
  if (!row || !canSeeBuilding(session, row.buildingId)) notFound();

  const [state] = await buildStates([row]);
  return state;
}

export async function getSensorHistory(
  session: Session,
  sensorId: string,
  fromMs: number,
  toMs: number,
): Promise<Reading[]> {
  requireUuid(sensorId);
  const [row] = await db
    .select({ externalId: sensors.externalId, buildingId: sensors.buildingId })
    .from(sensors)
    .where(and(eq(sensors.id, sensorId), eq(sensors.isActive, true)))
    .limit(1);

  if (!row || !canSeeBuilding(session, row.buildingId)) notFound();

  // Our own time series is the archive: Tuya keeps roughly a week of logs and
  // charges for the statistics APIs. It is already bucketed in SQL, so there is
  // nothing left to downsample here — and no provider call on a page render.
  return readingsInRange(sensorId, fromMs, toMs);
}

/** Room / department / floor names for a set of rooms, for labelling in the UI. */
export async function locationsOf(roomIds: string[]): Promise<
  Map<string, { room: string; department: string; floor: string }>
> {
  const unique = [...new Set(roomIds)].filter((id) => isUuid(id));
  if (unique.length === 0) return new Map();

  const rows = await db
    .select({
      roomId: rooms.id,
      room: rooms.name,
      department: departments.name,
      floor: floors.name,
    })
    .from(rooms)
    .innerJoin(departments, eq(departments.id, rooms.departmentId))
    .innerJoin(floors, eq(floors.id, departments.floorId))
    .where(inArray(rooms.id, unique));

  return new Map(rows.map((r) => [r.roomId, { room: r.room, department: r.department, floor: r.floor }]));
}

type SensorRow = {
  id: string;
  externalId: string;
  name: string;
  buildingId: string;
  roomId: string | null;
  lastSeenAt: Date | null;
};

/**
 * Builds the UI state from the DATABASE, never from the provider.
 *
 * Two reasons. The Tuya free tier allows roughly 26 000 calls a month, and a
 * page that called it on every render would spend that in days of ordinary
 * browsing. And a reading is a fact that was recorded — the dashboard should
 * show what the poller actually stored, not a fresh value that never made it
 * into the history.
 *
 * Calibration offsets are applied once, by the poller, on the way in; applying
 * them again here would double them.
 */
async function buildStates(rows: SensorRow[]): Promise<SensorState[]> {
  if (rows.length === 0) return [];

  const now = requestNow();
  const ids = rows.map((r) => r.id);

  const [latestRows, sparkRows] = await Promise.all([
    // Newest row per sensor — DISTINCT ON is the cheap way to do this in Postgres.
    db
      .selectDistinctOn([readings.sensorId], {
        sensorId: readings.sensorId,
        ts: readings.ts,
        tempC: readings.tempC,
        humidity: readings.humidity,
        battery: readings.battery,
      })
      .from(readings)
      .where(inArray(readings.sensorId, ids))
      .orderBy(readings.sensorId, desc(readings.ts)),
    db
      .select({
        sensorId: readings.sensorId,
        ts: readings.ts,
        tempC: readings.tempC,
        humidity: readings.humidity,
        battery: readings.battery,
      })
      .from(readings)
      .where(
        and(inArray(readings.sensorId, ids), gte(readings.ts, new Date(now - SPARK_WINDOW_MS))),
      )
      .orderBy(asc(readings.ts)),
  ]);

  const latest = new Map(latestRows.map((r) => [r.sensorId, r]));

  const spark = new Map<string, Reading[]>();
  for (const row of sparkRows) {
    const list = spark.get(row.sensorId) ?? [];
    list.push({
      sensorId: row.sensorId,
      ts: row.ts.getTime(),
      tempC: row.tempC ?? 0,
      humidity: row.humidity ?? 0,
      battery: row.battery ?? 0,
    });
    spark.set(row.sensorId, list);
  }

  return rows.map((row) => {
    const newest = latest.get(row.id);
    const reading: Reading | null = newest
      ? {
          sensorId: row.id,
          ts: newest.ts.getTime(),
          tempC: newest.tempC ?? 0,
          humidity: newest.humidity ?? 0,
          battery: newest.battery ?? 0,
        }
      : null;

    const sensor: Sensor = {
      id: row.id,
      externalId: row.externalId,
      name: row.name,
      buildingId: row.buildingId,
      roomId: row.roomId ?? "",
      isActive: true,
    };

    /*
     * Last CONTACT, not the timestamp of the last stored row.
     *
     * The poller deliberately skips writing a reading whose value has not
     * moved, so a healthy sensor sitting at a steady temperature can have its
     * newest row be half an hour old while it has been answering all along.
     * Using the row's timestamp reported "25 minutes ago" for a device that had
     * replied two minutes earlier — and, on the same 30-minute threshold, would
     * eventually have declared it offline while the alert engine (which reads
     * last_seen_at) still considered it perfectly alive.
     */
    const contactAt = row.lastSeenAt?.getTime() ?? reading?.ts ?? null;

    return {
      sensor,
      latest: reading,
      lastSeen: contactAt,
      isOnline: !isOffline(contactAt, now),
      spark: spark.get(row.id) ?? [],
    };
  });
}
