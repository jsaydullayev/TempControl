import {
  AlertTriangle,
  BatteryLow,
  CheckCircle2,
  CircleAlert,
  CircleSlash,
  OctagonAlert,
} from "lucide-react";

import type { Severity } from "@/lib/types";

export type ChipKind = Severity | "offline" | "lowBattery";

const ICONS: Record<ChipKind, typeof CheckCircle2> = {
  good: CheckCircle2,
  warning: AlertTriangle,
  serious: CircleAlert,
  critical: OctagonAlert,
  offline: CircleSlash,
  lowBattery: BatteryLow,
};

const COLOR_VAR: Record<ChipKind, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  offline: "var(--ink-muted)",
  lowBattery: "var(--status-warning)",
};

/**
 * Status is never carried by colour alone — every chip ships an icon AND a
 * label, which is what makes the palette safe for colour-blind readers and in
 * forced-colours mode.
 */
export function StatusChip({ kind, label }: { kind: ChipKind; label: string }) {
  const Icon = ICONS[kind];
  const color = COLOR_VAR[kind];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}
