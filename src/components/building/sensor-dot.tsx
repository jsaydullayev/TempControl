import Link from "next/link";
import { requestNow } from "@/lib/now";

import { relativeTimeParts } from "@/lib/format";
import { summariseSensor } from "@/lib/sensor-status";
import { formatHumidity, formatTemp } from "@/lib/format";
import type { SensorState } from "@/lib/types";

const DOT_COLOR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  offline: "var(--ink-muted)",
  lowBattery: "var(--status-warning)",
};

interface Props {
  state: SensorState;
  statusLabel: string;
  batteryLabel: string;
  seenLabel: string;
}

/**
 * One sensor as it appears inside a room on the floor plan.
 *
 * The hit area is 24px even though the dot is 10px — a plan full of pinpoint
 * targets is unusable, especially on touch.
 */
export function SensorDot({ state, statusLabel, batteryLabel, seenLabel }: Props) {
  const summary = summariseSensor(state);
  const color = DOT_COLOR[summary.kind];

  const value = state.latest
    ? `${formatTemp(state.latest.tempC)} °C · ${formatHumidity(state.latest.humidity)}%`
    : "—";

  // Everything the card shows, so hovering the plan never sends you hunting.
  const rel = relativeTimeParts(state.lastSeen, requestNow());
  const minutes = rel ? `${rel.count}` : "—";
  const title = [
    state.sensor.name,
    value,
    `${batteryLabel}: ${state.latest ? `${state.latest.battery}%` : "—"}`,
    `${seenLabel}: ${rel?.key === "justNow" ? "~0" : minutes}`,
    statusLabel,
  ].join(" · ");

  return (
    <Link
      href={`/sensors/${state.sensor.id}`}
      title={title}
      aria-label={title}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full focus-visible:ring-2"
    >
      <span
        aria-hidden
        className="block h-2.5 w-2.5 rounded-full"
        style={{
          // Offline reads as an empty outline, so it is distinguishable without colour.
          background: summary.offline ? "transparent" : color,
          border: `2px solid ${summary.offline ? "var(--ink-muted)" : "var(--paper)"}`,
          boxShadow: summary.offline ? "none" : `0 0 0 1px ${color}`,
        }}
      />
    </Link>
  );
}
