import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { departments, readings, rooms, sensors } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import type { Reading } from "@/lib/types";
import { canSeeBuilding, type Session } from "@/server/auth/dal";
import { readingsInRange } from "@/server/ingest/poll";

/** Scoped history reads for the comparison page. */

export interface SensorOption {
  id: string;
  name: string;
  room: string;
}

export interface SeriesStats {
  sensorId: string;
  name: string;
  tempMin: number | null;
  tempAvg: number | null;
  tempMax: number | null;
  humMin: number | null;
  humAvg: number | null;
  humMax: number | null;
  samples: number;
}

export async function listSensorOptions(
  session: Session,
  buildingId: string,
): Promise<SensorOption[]> {
  if (!isUuid(buildingId) || !canSeeBuilding(session, buildingId)) notFound();

  const rows = await db
    .select({ id: sensors.id, name: sensors.name, room: rooms.name })
    .from(sensors)
    .innerJoin(rooms, eq(rooms.id, sensors.roomId))
    .innerJoin(departments, eq(departments.id, rooms.departmentId))
    .where(and(eq(sensors.buildingId, buildingId), eq(sensors.isActive, true)))
    .orderBy(asc(sensors.name));

  return rows.map((r) => ({ id: r.id, name: r.name, room: r.room ?? "" }));
}

/** Keeps only the ids that belong to this building — the rest simply vanish. */
export async function scopeSensorIds(
  session: Session,
  buildingId: string,
  requested: string[],
): Promise<string[]> {
  if (!isUuid(buildingId) || !canSeeBuilding(session, buildingId)) notFound();

  const valid = requested.filter(isUuid);
  if (valid.length === 0) return [];

  const rows = await db
    .select({ id: sensors.id })
    .from(sensors)
    .where(
      and(eq(sensors.buildingId, buildingId), eq(sensors.isActive, true), inArray(sensors.id, valid)),
    );

  // Order follows the request so colours stay attached to the same sensor.
  const allowed = new Set(rows.map((r) => r.id));
  return valid.filter((id) => allowed.has(id));
}

/**
 * Bucketed series per sensor. The bucketing happens in SQL, so a 90-day range
 * costs the same as a one-hour one on the wire.
 */
export async function seriesFor(
  sensorIds: string[],
  fromMs: number,
  toMs: number,
): Promise<Map<string, Reading[]>> {
  const result = new Map<string, Reading[]>();

  await Promise.all(
    sensorIds.map(async (id) => {
      result.set(id, await readingsInRange(id, fromMs, toMs, 300));
    }),
  );

  return result;
}

/** min / average / max per sensor over the range, computed in the database. */
export async function statsFor(
  sensorIds: string[],
  fromMs: number,
  toMs: number,
): Promise<SeriesStats[]> {
  if (sensorIds.length === 0) return [];

  const rows = await db
    .select({
      sensorId: readings.sensorId,
      name: sensors.name,
      tempMin: sql<number | null>`min(${readings.tempC})`,
      tempAvg: sql<number | null>`avg(${readings.tempC})`,
      tempMax: sql<number | null>`max(${readings.tempC})`,
      humMin: sql<number | null>`min(${readings.humidity})`,
      humAvg: sql<number | null>`avg(${readings.humidity})`,
      humMax: sql<number | null>`max(${readings.humidity})`,
      samples: sql<number>`count(*)`,
    })
    .from(readings)
    .innerJoin(sensors, eq(sensors.id, readings.sensorId))
    .where(
      and(
        inArray(readings.sensorId, sensorIds),
        gte(readings.ts, new Date(fromMs)),
        lte(readings.ts, new Date(toMs)),
      ),
    )
    .groupBy(readings.sensorId, sensors.name);

  const round = (v: number | null, digits = 1) =>
    v === null ? null : Math.round(Number(v) * 10 ** digits) / 10 ** digits;

  const byId = new Map(
    rows.map((r) => [
      r.sensorId,
      {
        sensorId: r.sensorId,
        name: r.name,
        tempMin: round(r.tempMin),
        tempAvg: round(r.tempAvg),
        tempMax: round(r.tempMax),
        humMin: round(r.humMin, 0),
        humAvg: round(r.humAvg, 0),
        humMax: round(r.humMax, 0),
        samples: Number(r.samples),
      },
    ]),
  );

  // Preserve the requested order so the table matches the chart legend.
  return sensorIds.map(
    (id) =>
      byId.get(id) ?? {
        sensorId: id,
        name: "",
        tempMin: null,
        tempAvg: null,
        tempMax: null,
        humMin: null,
        humAvg: null,
        humMax: null,
        samples: 0,
      },
  );
}
