import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { departments, readings, rooms, sensors } from "@/db/schema";
import { DEFAULT_THRESHOLDS } from "@/lib/types";
import { isUuid } from "@/lib/uuid";
import { rulesFor } from "@/server/alerts/rules";
import { canSeeBuilding, type Session } from "@/server/auth/dal";

/**
 * The monitoring report: one row per sensor, one column per time bucket, and
 * the min/max that bucket held.
 *
 * A matrix rather than a list of readings, because the report has to fit on a
 * single sheet. Thirty days of eleven sensors is a third of a million readings
 * and roughly three hundred daily rows — neither prints. Eleven rows by thirty
 * columns does, and it answers the question the report exists for: was anything
 * ever outside its limits, and when.
 */

export interface ReportCell {
  /** Bucket start, epoch ms. */
  ts: number;
  min: number | null;
  max: number | null;
  humMin: number | null;
  humMax: number | null;
}

export interface ReportRow {
  sensorId: string;
  name: string;
  room: string;
  department: string;
  limits: { min: number; max: number };
  cells: ReportCell[];
  /** Whole-period extremes, for the summary column. */
  overall: { min: number | null; max: number | null };
  /** Buckets that went outside the limits — the number the report is read for. */
  breaches: number;
}

export interface Report {
  from: number;
  to: number;
  bucketMs: number;
  /** Bucket starts, so the header and every row share one axis. */
  axis: number[];
  rows: ReportRow[];
}

export async function buildReport(
  session: Session,
  buildingId: string,
  fromMs: number,
  toMs: number,
  bucketMs: number,
): Promise<Report> {
  if (!isUuid(buildingId)) notFound();
  if (!canSeeBuilding(session, buildingId)) notFound();

  const sensorRows = await db
    .select({
      id: sensors.id,
      name: sensors.name,
      room: rooms.name,
      department: departments.name,
    })
    .from(sensors)
    .innerJoin(rooms, eq(rooms.id, sensors.roomId))
    .innerJoin(departments, eq(departments.id, rooms.departmentId))
    .where(and(eq(sensors.buildingId, buildingId), eq(sensors.isActive, true)))
    .orderBy(asc(departments.name), asc(sensors.name));

  // A fixed axis built from the range, not from the data: a bucket with no
  // readings has to appear as a gap, not vanish and shift every later column.
  const axis: number[] = [];
  const start = Math.floor(fromMs / bucketMs) * bucketMs;
  for (let t = start; t <= toMs; t += bucketMs) axis.push(t);

  if (sensorRows.length === 0) {
    return { from: fromMs, to: toMs, bucketMs, axis, rows: [] };
  }

  const seconds = bucketMs / 1000;
  const grouped = await db
    .select({
      sensorId: readings.sensorId,
      bucket: sql<string>`floor(extract(epoch from ${readings.ts}) / ${seconds}) * ${seconds}`,
      tempMin: sql<number>`min(${readings.tempC})`,
      tempMax: sql<number>`max(${readings.tempC})`,
      humMin: sql<number>`min(${readings.humidity})`,
      humMax: sql<number>`max(${readings.humidity})`,
    })
    .from(readings)
    .where(
      and(
        sql`${readings.sensorId} in (select id from ${sensors} where building_id = ${buildingId} and is_active = true)`,
        sql`${readings.ts} >= ${new Date(fromMs)}`,
        sql`${readings.ts} <= ${new Date(toMs)}`,
      ),
    )
    .groupBy(readings.sensorId, sql`2`);

  const bySensor = new Map<string, Map<number, ReportCell>>();
  for (const row of grouped) {
    const ts = Number(row.bucket) * 1000;
    const map = bySensor.get(row.sensorId) ?? new Map<number, ReportCell>();
    map.set(ts, {
      ts,
      min: round1(row.tempMin),
      max: round1(row.tempMax),
      humMin: round1(row.humMin),
      humMax: round1(row.humMax),
    });
    bySensor.set(row.sensorId, map);
  }

  // The same rule resolution the dashboard and the alert engine use, so a cell
  // marked as a breach here is one that actually raised an alert.
  const rules = await rulesFor(
    buildingId,
    sensorRows.map((s) => s.id),
  );

  const rows: ReportRow[] = sensorRows.map((sensor) => {
    const rule = rules.get(sensor.id);
    const limits = {
      min: rule?.temp.min ?? DEFAULT_THRESHOLDS.temp.min,
      max: rule?.temp.max ?? DEFAULT_THRESHOLDS.temp.max,
    };

    const found = bySensor.get(sensor.id) ?? new Map<number, ReportCell>();
    const cells = axis.map(
      (ts) => found.get(ts) ?? { ts, min: null, max: null, humMin: null, humMax: null },
    );

    const temps = cells.flatMap((c) => (c.min === null ? [] : [c.min, c.max as number]));
    const breaches = cells.filter(
      (c) => c.min !== null && (c.min < limits.min || (c.max as number) > limits.max),
    ).length;

    return {
      sensorId: sensor.id,
      name: sensor.name,
      room: sensor.room,
      department: sensor.department,
      limits,
      cells,
      overall: {
        min: temps.length ? round1(Math.min(...temps)) : null,
        max: temps.length ? round1(Math.max(...temps)) : null,
      },
      breaches,
    };
  });

  return { from: fromMs, to: toMs, bucketMs, axis, rows };
}

function round1(v: number | null): number | null {
  return v === null ? null : Math.round(Number(v) * 10) / 10;
}
