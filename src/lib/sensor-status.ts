import { evaluateMetric, isLowBattery, worstSeverity } from "@/lib/status";
import type { SensorState, Severity } from "@/lib/types";

export type StatusLabelKey =
  | "good"
  | "offline"
  | "lowBattery"
  | "tooCold"
  | "tooHot"
  | "tooDry"
  | "tooHumid";

export interface SensorStatusSummary {
  severity: Severity;
  /** The chip to render: a breach severity, or an offline/battery state. */
  kind: Severity | "offline" | "lowBattery";
  labelKey: StatusLabelKey;
  lowBattery: boolean;
  offline: boolean;
}

/**
 * Collapses a sensor's several signals into the one thing a card should say.
 * Offline wins over everything: a stale value is not a safe value.
 */
export function summariseSensor(state: SensorState): SensorStatusSummary {
  const lowBattery = isLowBattery(state.latest?.battery);

  if (!state.isOnline || !state.latest) {
    return {
      severity: "serious",
      kind: "offline",
      labelKey: "offline",
      lowBattery,
      offline: true,
    };
  }

  const temp = evaluateMetric("temp", state.latest.tempC);
  const hum = evaluateMetric("hum", state.latest.humidity);
  const severity = worstSeverity([temp.severity, hum.severity]);

  if (severity === "good") {
    return lowBattery
      ? { severity: "warning", kind: "lowBattery", labelKey: "lowBattery", lowBattery, offline: false }
      : { severity: "good", kind: "good", labelKey: "good", lowBattery, offline: false };
  }

  // Name the worse of the two breaches so the label is specific, not just "critical".
  const tempWorse = temp.severity !== "good" && temp.deviation >= hum.deviation / 2.5;
  const labelKey: StatusLabelKey = tempWorse
    ? temp.direction === "below"
      ? "tooCold"
      : "tooHot"
    : hum.direction === "below"
      ? "tooDry"
      : "tooHumid";

  return { severity, kind: severity, labelKey, lowBattery, offline: false };
}
