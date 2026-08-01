import {
  DEFAULT_THRESHOLDS,
  LOW_BATTERY_PCT,
  OFFLINE_AFTER_MS,
  type Metric,
  type Severity,
  type Threshold,
} from "@/lib/types";

/** How far past a bound a value must drift before it escalates a band. */
const ESCALATION: Record<Metric, { warning: number; serious: number }> = {
  temp: { warning: 2, serious: 4 },
  hum: { warning: 5, serious: 10 },
};

export interface MetricStatus {
  severity: Severity;
  /** null when inside the comfort band */
  direction: "below" | "above" | null;
  /** absolute distance past the breached bound, 0 when inside */
  deviation: number;
}

export function evaluateMetric(
  metric: Metric,
  value: number,
  threshold: Threshold = DEFAULT_THRESHOLDS[metric],
): MetricStatus {
  const low = threshold.min - threshold.hysteresis;
  const high = threshold.max + threshold.hysteresis;

  if (value >= low && value <= high) {
    return { severity: "good", direction: null, deviation: 0 };
  }

  const direction = value < low ? "below" : "above";
  const deviation = direction === "below" ? low - value : value - high;
  const steps = ESCALATION[metric];
  const severity: Severity =
    deviation <= steps.warning
      ? "warning"
      : deviation <= steps.serious
        ? "serious"
        : "critical";

  return { severity, direction, deviation };
}

export function isOffline(lastSeen: number | null, now: number): boolean {
  if (lastSeen === null) return true;
  return now - lastSeen > OFFLINE_AFTER_MS;
}

export function isLowBattery(battery: number | null | undefined): boolean {
  return typeof battery === "number" && battery <= LOW_BATTERY_PCT;
}

/** The single worst severity across a set — drives roll-up tiles and cards. */
export function worstSeverity(list: Severity[]): Severity {
  const order: Severity[] = ["good", "warning", "serious", "critical"];
  return list.reduce<Severity>(
    (worst, s) => (order.indexOf(s) > order.indexOf(worst) ? s : worst),
    "good",
  );
}

/** CSS colour token for a severity. Always paired with an icon + label in the UI. */
export function severityVar(severity: Severity): string {
  return `var(--status-${severity})`;
}
