import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, X } from "lucide-react";
import { requestNow } from "@/lib/now";

import { formatHumidity, formatTemp, relativeTimeParts } from "@/lib/format";
import { summariseSensor } from "@/lib/sensor-status";
import { DEFAULT_THRESHOLDS, type Room, type SensorState } from "@/lib/types";
import { Sparkline } from "@/components/charts/sparkline";
import { StatusChip } from "@/components/sensors/status-chip";

interface Props {
  room: Room;
  states: SensorState[];
  breadcrumb: string;
}

const VALUE_COLOR: Record<string, string> = {
  good: "var(--ink-primary)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  offline: "var(--ink-muted)",
  lowBattery: "var(--ink-primary)",
};

/** Detail for the room selected on the plan — the plan stays visible beside it. */
export async function RoomPanel({ room, states, breadcrumb }: Props) {
  const t = await getTranslations();
  const now = requestNow();

  const live = states.filter((s) => s.isOnline && s.latest);
  const avg = (pick: (s: SensorState) => number) =>
    live.length ? live.reduce((a, s) => a + pick(s), 0) / live.length : null;

  const temp = avg((s) => s.latest!.tempC);
  const hum = avg((s) => s.latest!.humidity);

  // Every sensor in a room normally shares one rule; when they do not, showing
  // the first one's limits is still truer than showing the global default.
  const first = states[0];
  const band = first?.thresholds ?? DEFAULT_THRESHOLDS;

  return (
    <aside
      className="flex w-full shrink-0 flex-col gap-4 rounded-xl p-4 lg:w-[320px]"
      style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="truncate text-[11px] font-medium tracking-[0.08em] uppercase"
            style={{ color: "var(--ink-muted)" }}
          >
            {breadcrumb}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold">{room.name}</p>
        </div>
        <Link
          href="/"
          aria-label={t("common.close")}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
        >
          <X size={14} aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          label={t("sensors.temperature")}
          value={temp === null ? "—" : formatTemp(temp)}
          unit="°C"
          norm={`${t("plan.norm")} ${band.temp.min}–${band.temp.max} °C`}
        />
        <Metric
          label={t("sensors.humidity")}
          value={hum === null ? "—" : formatHumidity(hum)}
          unit="%"
          norm={`${t("plan.norm")} ${band.hum.min}–${band.hum.max} %`}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p
          className="text-[11px] font-medium tracking-[0.08em] uppercase"
          style={{ color: "var(--ink-muted)" }}
        >
          {t("nav.sensors")}
        </p>

        {states.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("common.noData")}
          </p>
        ) : (
          states.map((state) => {
            const summary = summariseSensor(state);
            const rel = relativeTimeParts(state.lastSeen, now);
            return (
              <div
                key={state.sensor.id}
                className="flex flex-col gap-2 rounded-lg p-3"
                style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{state.sensor.name}</span>
                  <StatusChip kind={summary.kind} label={t(`status.${summary.labelKey}`)} />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <p className="flex items-baseline gap-1.5">
                    <span
                      className="text-lg leading-none font-semibold"
                      style={{ color: VALUE_COLOR[summary.kind] }}
                    >
                      {state.latest ? `${formatTemp(state.latest.tempC)} °C` : "— —"}
                    </span>
                    {state.latest ? (
                      <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                        {formatHumidity(state.latest.humidity)} %
                      </span>
                    ) : null}
                  </p>
                  {state.latest ? (
                    <Sparkline
                      points={state.spark}
                      field="tempC"
                      color={summary.severity === "good" ? "var(--series-1)" : VALUE_COLOR[summary.kind]}
                      width={80}
                      height={26}
                      label={state.sensor.name}
                    />
                  ) : null}
                </div>

                <div
                  className="flex items-center justify-between text-[11px]"
                  style={{ color: "var(--ink-muted)" }}
                >
                  <span className="tnum">
                    {state.latest ? `${state.latest.battery} %` : "—"}
                    {rel ? ` · ${t(`time.${rel.key}`, { count: rel.count })}` : ""}
                  </span>
                  <Link
                    href={`/sensors/${state.sensor.id}`}
                    className="inline-flex items-center gap-0.5"
                    style={{ color: "var(--series-1)" }}
                  >
                    {t("common.open")}
                    <ChevronRight size={12} aria-hidden />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
  unit,
  norm,
}: {
  label: string;
  value: string;
  unit: string;
  norm: string;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <p
        className="text-[11px] font-medium tracking-[0.08em] uppercase"
        style={{ color: "var(--ink-muted)" }}
      >
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl leading-none font-semibold tracking-tight">{value}</span>
        <span className="text-xs" style={{ color: "var(--ink-secondary)" }}>
          {unit}
        </span>
      </p>
      <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
        {norm}
      </p>
    </div>
  );
}
