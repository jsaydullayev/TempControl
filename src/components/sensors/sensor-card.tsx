import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Battery } from "lucide-react";

import { formatTemp, relativeTimeParts } from "@/lib/format";
import { summariseSensor } from "@/lib/sensor-status";
import type { SensorState } from "@/lib/types";
import { Sparkline } from "@/components/charts/sparkline";
import { StatusChip } from "@/components/sensors/status-chip";

interface Props {
  state: SensorState;
  roomName: string;
  now: number;
}

const VALUE_COLOR: Record<string, string> = {
  good: "var(--ink-primary)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  offline: "var(--ink-muted)",
  lowBattery: "var(--ink-primary)",
};

export async function SensorCard({ state, roomName, now }: Props) {
  const t = await getTranslations();
  const summary = summariseSensor(state);
  const rel = relativeTimeParts(state.lastSeen, now);
  const color = VALUE_COLOR[summary.kind];

  return (
    <Link
      href={`/sensors/${state.sensor.id}`}
      className="flex flex-col gap-3 rounded-xl p-4 transition-colors"
      style={{
        background: "var(--surface-1)",
        border: `1px solid ${summary.offline || summary.severity === "good" ? "var(--hairline)" : `color-mix(in srgb, ${color} 35%, transparent)`}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{state.sensor.name}</p>
          <p className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>
            {roomName}
          </p>
        </div>
        <StatusChip kind={summary.kind} label={t(`status.${summary.labelKey}`)} />
      </div>

      <div className="flex items-end justify-between gap-3">
        {/* Proportional figures on purpose — tabular-nums makes big numbers look loose. */}
        <p className="flex items-baseline gap-1">
          <span
            className="text-3xl leading-none font-semibold tracking-tight"
            style={{ color }}
          >
            {state.latest ? formatTemp(state.latest.tempC) : "— —"}
          </span>
          {state.latest ? (
            <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
              °C
            </span>
          ) : null}
        </p>

        {state.latest ? (
          <Sparkline
            points={state.spark}
            field="tempC"
            color={summary.severity === "good" ? "var(--series-1)" : color}
            width={130}
            height={34}
            label={`${state.sensor.name} — ${t("sensors.temperature")}`}
          />
        ) : null}
      </div>

      <div
        className="flex items-center justify-between text-xs"
        style={{ color: "var(--ink-muted)" }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Battery
            size={14}
            aria-hidden
            style={{ color: summary.lowBattery ? "var(--status-warning)" : "var(--ink-muted)" }}
          />
          <span className="tnum">{state.latest ? `${state.latest.battery} %` : "—"}</span>
        </span>
        <span>{rel ? t(`time.${rel.key}`, { count: rel.count }) : t("sensors.never")}</span>
      </div>
    </Link>
  );
}
