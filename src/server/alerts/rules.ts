import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { thresholds } from "@/db/schema";
import { DEFAULT_THRESHOLDS, type Metric } from "@/lib/types";

/**
 * Threshold resolution: sensor rule → building rule → application default.
 *
 * Kept as one lookup for a whole building so the evaluator makes a single
 * query per cycle rather than one per sensor.
 */

export interface Rule {
  metric: Metric;
  min: number;
  max: number;
  hysteresis: number;
  sustainMinutes: number;
}

export const DEFAULT_SUSTAIN_MINUTES = 10;

export function defaultRule(metric: Metric): Rule {
  const base = DEFAULT_THRESHOLDS[metric];
  return {
    metric,
    min: base.min,
    max: base.max,
    hysteresis: base.hysteresis,
    sustainMinutes: DEFAULT_SUSTAIN_MINUTES,
  };
}

export type RuleSet = Record<Metric, Rule>;

function toRule(row: typeof thresholds.$inferSelect): Rule {
  return {
    metric: row.metric as Metric,
    min: row.minValue,
    max: row.maxValue,
    hysteresis: row.hysteresis,
    sustainMinutes: row.sustainMinutes,
  };
}

/** Effective rules per sensor, with building and application fallbacks applied. */
export async function rulesFor(
  buildingId: string,
  sensorIds: string[],
): Promise<Map<string, RuleSet>> {
  const fallback: RuleSet = { temp: defaultRule("temp"), hum: defaultRule("hum") };

  if (sensorIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(thresholds)
    .where(
      and(
        eq(thresholds.isActive, true),
        or(
          and(eq(thresholds.scope, "building"), eq(thresholds.scopeId, buildingId)),
          and(eq(thresholds.scope, "sensor"), inArray(thresholds.scopeId, sensorIds)),
        ),
      ),
    );

  const buildingRules: Partial<RuleSet> = {};
  const sensorRules = new Map<string, Partial<RuleSet>>();

  for (const row of rows) {
    const rule = toRule(row);
    if (row.scope === "building") {
      buildingRules[rule.metric] = rule;
    } else {
      const existing = sensorRules.get(row.scopeId) ?? {};
      existing[rule.metric] = rule;
      sensorRules.set(row.scopeId, existing);
    }
  }

  const resolved = new Map<string, RuleSet>();
  for (const sensorId of sensorIds) {
    const own = sensorRules.get(sensorId) ?? {};
    resolved.set(sensorId, {
      temp: own.temp ?? buildingRules.temp ?? fallback.temp,
      hum: own.hum ?? buildingRules.hum ?? fallback.hum,
    });
  }
  return resolved;
}

/**
 * Breach test with a deadband.
 *
 * Opening uses the OUTER edge (min − hysteresis) and closing uses the INNER one
 * (min), so a value hovering exactly on the limit cannot open and close an
 * alert on alternating cycles.
 */
export function breaches(value: number, rule: Rule): "below" | "above" | null {
  if (value < rule.min - rule.hysteresis) return "below";
  if (value > rule.max + rule.hysteresis) return "above";
  return null;
}

export function isBackInRange(value: number, rule: Rule): boolean {
  return value >= rule.min && value <= rule.max;
}
