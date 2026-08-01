import { and, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { alerts, readings, sensors } from "@/db/schema";
import { evaluateMetric } from "@/lib/status";
import { LOW_BATTERY_PCT, OFFLINE_AFTER_MS, type Metric, type Severity } from "@/lib/types";
import { breaches, isBackInRange, rulesFor, type Rule } from "@/server/alerts/rules";

/**
 * Alert evaluation.
 *
 * Runs after every ingest cycle. Two properties matter more than anything else:
 *
 *  - **No flapping.** A breach must hold for `sustainMinutes` before it opens,
 *    and it only closes once the value is back INSIDE the limits. A single
 *    confused reading, or a value sitting exactly on the limit, produces nothing.
 *  - **No duplicates.** At most one open alert per (sensor, kind); an ongoing
 *    problem updates that row instead of creating another.
 */

export type AlertKind = "temp" | "hum" | "offline" | "battery";

export interface EvaluationResult {
  opened: number;
  resolved: number;
  checked: number;
}

interface Condition {
  kind: AlertKind;
  severity: Severity;
  direction: "below" | "above" | null;
  value: number | null;
}

export async function evaluateAll(now = Date.now()): Promise<EvaluationResult> {
  const result: EvaluationResult = { opened: 0, resolved: 0, checked: 0 };

  const active = await db
    .select({
      id: sensors.id,
      buildingId: sensors.buildingId,
      lastSeenAt: sensors.lastSeenAt,
      createdAt: sensors.createdAt,
    })
    .from(sensors)
    .where(and(eq(sensors.isActive, true), sql`${sensors.roomId} is not null`));

  if (active.length === 0) return result;
  result.checked = active.length;

  const open = await db
    .select()
    .from(alerts)
    .where(ne(alerts.state, "resolved"));

  const openByKey = new Map(open.map((a) => [`${a.sensorId}:${a.kind}`, a]));

  // Rules are resolved per building, so group the sensors first.
  const byBuilding = new Map<string, typeof active>();
  for (const sensor of active) {
    const list = byBuilding.get(sensor.buildingId) ?? [];
    list.push(sensor);
    byBuilding.set(sensor.buildingId, list);
  }

  for (const [buildingId, list] of byBuilding) {
    const rules = await rulesFor(
      buildingId,
      list.map((s) => s.id),
    );

    for (const sensor of list) {
      const ruleSet = rules.get(sensor.id);
      if (!ruleSet) continue;

      const conditions = await conditionsFor(sensor, ruleSet, now, openByKey);
      const byKind = new Map(conditions.map((c) => [c.kind, c]));

      for (const kind of ["temp", "hum", "offline", "battery"] as AlertKind[]) {
        const condition = byKind.get(kind);
        const existing = openByKey.get(`${sensor.id}:${kind}`);

        if (condition && !existing) {
          await db.insert(alerts).values({
            sensorId: sensor.id,
            buildingId: sensor.buildingId,
            kind,
            severity: condition.severity,
            direction: condition.direction,
            valueAtOpen: condition.value,
            lastValue: condition.value,
          });
          result.opened++;
        } else if (condition && existing) {
          // Still wrong — keep the row current instead of opening another.
          await db
            .update(alerts)
            .set({ lastValue: condition.value, severity: condition.severity })
            .where(eq(alerts.id, existing.id));
        } else if (!condition && existing) {
          await db
            .update(alerts)
            .set({ state: "resolved", resolvedAt: new Date(now) })
            .where(eq(alerts.id, existing.id));
          result.resolved++;
        }
      }
    }
  }

  return result;
}

/** Comfortably covers the offline cut-off and the 30-minute ingest heartbeat. */
const MIN_LOOKBACK_MS = 2 * 60 * 60 * 1000;

type ReadingRow = { ts: Date; tempC: number | null; humidity: number | null; battery: number | null };

async function conditionsFor(
  sensor: { id: string; lastSeenAt: Date | null; createdAt: Date },
  ruleSet: Record<Metric, Rule>,
  now: number,
  openByKey: Map<string, { direction: string | null; severity: string }>,
): Promise<Condition[]> {
  const found: Condition[] = [];

  /*
   * Offline wins over everything: a stale value is not a safe value, so the
   * threshold checks are skipped entirely while the sensor is silent.
   *
   * A sensor that has NEVER reported is measured from when it was bound, not
   * treated as infinitely silent — otherwise binding a device raised an offline
   * alert on the spot, before the poller had its first chance to reach it.
   */
  const since = sensor.lastSeenAt ?? sensor.createdAt;
  if (now - since.getTime() > OFFLINE_AFTER_MS) {
    return [{ kind: "offline", severity: "serious", direction: null, value: null }];
  }

  // One window fetch serves both the current value and the "has it held" test.
  const longestSustainMs =
    Math.max(ruleSet.temp.sustainMinutes, ruleSet.hum.sustainMinutes) * 60_000;
  const lookback = Math.max(longestSustainMs * 4, MIN_LOOKBACK_MS);

  const rows: ReadingRow[] = await db
    .select({
      ts: readings.ts,
      tempC: readings.tempC,
      humidity: readings.humidity,
      battery: readings.battery,
    })
    .from(readings)
    .where(and(eq(readings.sensorId, sensor.id), gte(readings.ts, new Date(now - lookback))))
    .orderBy(desc(readings.ts));

  const latest = rows[0];
  if (!latest) return found;

  if (typeof latest.battery === "number" && latest.battery <= LOW_BATTERY_PCT) {
    found.push({ kind: "battery", severity: "warning", direction: null, value: latest.battery });
  }

  for (const metric of ["temp", "hum"] as Metric[]) {
    const rule = ruleSet[metric];
    const value = metric === "temp" ? latest.tempC : latest.humidity;
    if (value === null) continue;

    const direction = breaches(value, rule);
    const open = openByKey.get(`${sensor.id}:${metric}`);

    /*
     * An OPEN alert closes only once the value is back inside min/max — the
     * deadband. Testing it with `breaches` on both sides made the two edges the
     * same number, so the hysteresis was doing nothing: a value hovering on
     * min − hysteresis opened and closed the alert on alternating cycles.
     */
    if (open) {
      if (isBackInRange(value, rule)) continue;
      found.push({
        kind: metric,
        // Inside the deadband there is no direction to derive; the one the
        // alert opened with is still the true one.
        severity: direction ? severityOf(metric, value, rule) : (open.severity as Severity),
        direction: (direction ?? open.direction) as "below" | "above" | null,
        value,
      });
      continue;
    }

    if (!direction) continue;
    if (!sustained(rows, metric, rule, now)) continue;

    found.push({ kind: metric, severity: severityOf(metric, value, rule), direction, value });
  }

  return found;
}

function severityOf(metric: Metric, value: number, rule: Rule): Severity {
  return evaluateMetric(metric, value, {
    metric,
    min: rule.min,
    max: rule.max,
    hysteresis: rule.hysteresis,
  }).severity;
}

/**
 * True when the breach has actually HELD for `sustainMinutes`.
 *
 * Not "every reading in the window breached" — with a single sample that test
 * passes instantly, so a freshly bound sensor would alert on its very first
 * reading and the guarantee would be empty. Instead the breach is dated from
 * the last reading that was still inside the limits: that is the moment it
 * started, and only then can its duration be compared to the rule.
 *
 * Derived from stored readings rather than remembered state, so a restart of
 * the worker changes nothing.
 */
function sustained(rows: ReadingRow[], metric: Metric, rule: Rule, now: number): boolean {
  const windowMs = rule.sustainMinutes * 60_000;
  if (windowMs === 0) return true;
  if (rows.length === 0) return false;

  // Walk back from the newest until a reading that was NOT breaching.
  let breachingSince: number | null = null;
  for (const row of rows) {
    const value = metric === "temp" ? row.tempC : row.humidity;
    if (value === null || breaches(value, rule) === null) break;
    breachingSince = row.ts.getTime();
  }

  if (breachingSince === null) return false;

  // Every sample we hold breaches, but they may not span the window yet —
  // that is not evidence the condition held, only that we have not seen it end.
  return now - breachingSince >= windowMs;
}

/** Acknowledge an open alert. Resolution stays automatic — this is just "seen and owned". */
export async function acknowledgeAlert(alertId: string, actor: string): Promise<void> {
  await db
    .update(alerts)
    .set({ state: "ack", ackedAt: new Date(), ackedBy: actor })
    .where(and(eq(alerts.id, alertId), eq(alerts.state, "open")));
}

/** Marks a building's unseen alerts as seen — called when the bell is opened. */
export async function markAlertsSeen(buildingId: string): Promise<void> {
  await db
    .update(alerts)
    .set({ seenAt: new Date() })
    .where(
      and(eq(alerts.buildingId, buildingId), isNull(alerts.seenAt), ne(alerts.state, "resolved")),
    );
}
