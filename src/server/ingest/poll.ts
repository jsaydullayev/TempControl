import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { readings, sensors } from "@/db/schema";
import { getProvider } from "@/server/providers";

/**
 * Ingest: pull the current values and write them to the time series.
 *
 * This is the piece that makes long history possible at all — Tuya keeps only
 * about a week of device logs, and its statistics APIs are a paid add-on, so
 * anything beyond that has to be our own data.
 */

export const RETENTION_DAYS = 90;

export interface PollResult {
  sensors: number;
  written: number;
  skipped: number;
  errors: string[];
}

/** Values this close to the previous row are not worth another row. */
const TEMP_EPSILON = 0.05;
const HUM_EPSILON = 0.5;

/** Write at least this often even when nothing changed, so gaps mean "no data". */
const HEARTBEAT_MS = 30 * 60 * 1000;

export async function pollOnce(): Promise<PollResult> {
  const provider = getProvider();
  const result: PollResult = { sensors: 0, written: 0, skipped: 0, errors: [] };

  const active = await db
    .select({ id: sensors.id, externalId: sensors.externalId, tempOffset: sensors.tempOffset, humOffset: sensors.humOffset })
    .from(sensors)
    .where(eq(sensors.isActive, true));

  if (active.length === 0) return result;
  result.sensors = active.length;

  const byExternal = new Map(active.map((s) => [s.externalId, s]));

  let latest;
  try {
    // One bulk call, not one per sensor: the free Tuya tier allows ~26k
    // calls a month, and per-sensor polling would burn that in days.
    latest = await provider.getStatus(active.map((s) => s.externalId));
  } catch (error) {
    result.errors.push(String(error));
    return result;
  }

  // Previous row per sensor, to decide whether this reading adds anything.
  const previous = await lastReadings(active.map((s) => s.id));

  const rows: (typeof readings.$inferInsert)[] = [];
  const seen: { id: string; at: Date }[] = [];

  for (const reading of latest) {
    const sensor = byExternal.get(reading.sensorId);
    if (!sensor) continue;

    const tempC = round1(reading.tempC + sensor.tempOffset);
    const humidity = Math.round(reading.humidity + sensor.humOffset);
    const at = new Date(reading.ts);

    seen.push({ id: sensor.id, at });

    const prev = previous.get(sensor.id);
    const unchanged =
      prev &&
      Math.abs((prev.tempC ?? 0) - tempC) < TEMP_EPSILON &&
      Math.abs((prev.humidity ?? 0) - humidity) < HUM_EPSILON &&
      at.getTime() - prev.ts.getTime() < HEARTBEAT_MS;

    if (unchanged) {
      result.skipped++;
      continue;
    }

    rows.push({ sensorId: sensor.id, ts: at, tempC, humidity, battery: reading.battery });
  }

  if (rows.length > 0) {
    // A row for this instant may already exist — another poller, or a retry
    // after a partial write. Re-inserting it is not new information.
    const written = await db
      .insert(readings)
      .values(rows)
      .onConflictDoNothing({ target: [readings.sensorId, readings.ts] })
      .returning({ id: readings.id });
    result.written = written.length;
  }

  // Record contact even when the value was unchanged — "last seen" is about the
  // device being alive, not about the number moving.
  for (const s of seen) {
    await db.update(sensors).set({ lastSeenAt: s.at }).where(eq(sensors.id, s.id));
  }

  /*
   * Name the sensors the provider said nothing about.
   *
   * A device whose data points we cannot read returns no reading at all, and
   * without this the only symptom is a sensor that sits at "never" forever
   * while the admin panel cheerfully lists it as online. Saying which id was
   * missed turns a mystery into a lookup.
   */
  const answered = new Set(latest.map((r) => r.sensorId));
  const silent = active.filter((s) => !answered.has(s.externalId));
  if (silent.length > 0) {
    result.errors.push(`no reading for: ${silent.map((s) => s.externalId).join(", ")}`);
  }

  return result;
}

/** Deletes readings past the retention window. Returns how many went. */
export async function trimOldReadings(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const deleted = await db.delete(readings).where(lt(readings.ts, cutoff)).returning({ id: readings.id });
  return deleted.length;
}

async function lastReadings(sensorIds: string[]) {
  if (sensorIds.length === 0) return new Map<string, { ts: Date; tempC: number | null; humidity: number | null }>();

  // DISTINCT ON is the cheap way to get the newest row per sensor in Postgres.
  const rows = await db
    .selectDistinctOn([readings.sensorId], {
      sensorId: readings.sensorId,
      ts: readings.ts,
      tempC: readings.tempC,
      humidity: readings.humidity,
    })
    .from(readings)
    .where(inArray(readings.sensorId, sensorIds))
    .orderBy(readings.sensorId, desc(readings.ts));

  return new Map(rows.map((r) => [r.sensorId, { ts: r.ts, tempC: r.tempC, humidity: r.humidity }]));
}

/** Bucketed history straight from the database, downsampled in SQL. */
export async function readingsInRange(
  sensorId: string,
  fromMs: number,
  toMs: number,
  buckets = 400,
) {
  const from = new Date(fromMs);
  const to = new Date(toMs);
  const widthMs = Math.max(60_000, Math.floor((toMs - fromMs) / buckets));

  // avg/min/max per bucket: a chart never needs the raw rows, and sending them
  // would move megabytes to render a few hundred pixels.
  const rows = await db
    .select({
      bucket: sql<Date>`to_timestamp(floor(extract(epoch from ${readings.ts}) / ${widthMs / 1000}) * ${widthMs / 1000})`,
      tempAvg: sql<number>`avg(${readings.tempC})`,
      tempMin: sql<number>`min(${readings.tempC})`,
      tempMax: sql<number>`max(${readings.tempC})`,
      humAvg: sql<number>`avg(${readings.humidity})`,
      battery: sql<number>`min(${readings.battery})`,
    })
    .from(readings)
    .where(and(eq(readings.sensorId, sensorId), sql`${readings.ts} >= ${from}`, sql`${readings.ts} <= ${to}`))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return rows.map((r) => ({
    sensorId,
    ts: new Date(r.bucket).getTime(),
    tempC: round1(Number(r.tempAvg)),
    humidity: Math.round(Number(r.humAvg)),
    battery: Math.round(Number(r.battery ?? 0)),
    tempMin: round1(Number(r.tempMin)),
    tempMax: round1(Number(r.tempMax)),
  }));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
