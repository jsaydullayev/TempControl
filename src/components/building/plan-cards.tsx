import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatHumidity, formatTemp } from "@/lib/format";
import { summariseSensor } from "@/lib/sensor-status";
import { evaluateMetric } from "@/lib/status";
import type { SensorState } from "@/lib/types";
import { FreeCanvas } from "@/components/building/free-canvas";

const DOT: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  offline: "var(--ink-muted)",
  lowBattery: "var(--status-warning)",
};

export interface Entry {
  id: string;
  name: string;
  meta: string;
  states: SensorState[];
  href: string;
}

interface Labels {
  hum: string;
  tooCold: string;
  tooHot: string;
}

/**
 * The plan panel: a card per department, drilling into a card per room.
 * Cards can be dragged anywhere on the canvas.
 */
export async function PlanCards({
  entries,
  storageKey,
  eyebrow,
  hint,
  editable,
  header,
  backHref,
}: {
  entries: Entry[];
  storageKey: string;
  eyebrow: string;
  hint: string;
  editable: boolean;
  header?: { name: string; meta: string };
  backHref?: string;
}) {
  const t = await getTranslations();

  const labels: Labels = {
    hum: t("plan.humShort"),
    tooCold: t("status.tooCold"),
    tooHot: t("status.tooHot"),
  };

  return (
    <div className="flex flex-col gap-2">
      {header ? (
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={t("common.back")}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--surface-2)", color: "var(--ink-secondary)" }}
            >
              <ChevronLeft size={16} aria-hidden />
            </Link>
          ) : null}
          <div>
            <p className="text-sm font-semibold">{header.name}</p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {header.meta}
            </p>
          </div>
        </div>
      ) : null}

      <FreeCanvas
        storageKey={storageKey}
        resetLabel={t("plan.resetOrder")}
        eyebrow={eyebrow}
        hint={editable ? `${hint} ${t("plan.dragAdmin")}` : hint}
        editable={editable}
        items={entries.map((entry) => ({
          id: entry.id,
          href: entry.href,
          node: <EntryCard entry={entry} labels={labels} />,
        }))}
      />
    </div>
  );
}

function EntryCard({ entry, labels }: { entry: Entry; labels: Labels }) {
  const summaries = entry.states.map(summariseSensor);
  const problems = summaries.filter((s) => s.offline || s.severity !== "good").length;

  const live = entry.states.filter((s) => s.isOnline && s.latest);
  const avgTemp = live.length ? live.reduce((a, s) => a + s.latest!.tempC, 0) / live.length : null;
  const avgHum = live.length ? live.reduce((a, s) => a + s.latest!.humidity, 0) / live.length : null;

  const status = avgTemp === null ? null : evaluateMetric("temp", avgTemp);
  const breached = status !== null && status.direction !== null;
  const kind = avgTemp === null ? "offline" : breached ? status!.severity : "good";
  const color = DOT[kind];
  const breachLabel = !breached
    ? null
    : status!.direction === "below"
      ? labels.tooCold
      : labels.tooHot;

  return (
    <div className="relative h-full w-full">
      <div
        className="flex h-full w-full items-center gap-3 rounded-xl px-3.5 py-3"
        style={{
          background: "var(--surface-1)",
          border: `1px solid ${breached || kind === "offline" ? `color-mix(in srgb, ${color} 55%, transparent)` : "var(--hairline)"}`,
        }}
      >
        {/* Colour is doubled by the badge and the word, never carrying meaning alone. */}
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background: kind === "offline" ? "transparent" : color,
            border: kind === "offline" ? `1.5px solid ${color}` : undefined,
          }}
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{entry.name}</span>
          <span className="block truncate text-xs" style={{ color: "var(--ink-muted)" }}>
            {entry.meta}
          </span>
        </span>

        {breachLabel ? (
          <span
            className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {breachLabel}
          </span>
        ) : null}

        <span className="shrink-0 text-right">
          <span className="block whitespace-nowrap">
            <span
              className="text-lg leading-none font-semibold tracking-tight"
              style={{ color: breached ? color : "var(--ink-primary)" }}
            >
              {avgTemp === null ? "— —" : formatTemp(avgTemp)}
            </span>
            {avgTemp !== null ? (
              <span className="ml-0.5 text-xs" style={{ color: "var(--ink-secondary)" }}>
                °C
              </span>
            ) : null}
          </span>
          <span className="block text-xs whitespace-nowrap" style={{ color: "var(--ink-muted)" }}>
            {labels.hum} {avgHum === null ? "—" : `${formatHumidity(avgHum)} %`}
          </span>
        </span>

        <ChevronRight size={16} style={{ color: "var(--ink-muted)" }} aria-hidden />
      </div>

      {problems > 0 ? (
        <span
          className="pointer-events-none absolute -top-2 -right-2 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
          style={{ background: "var(--status-critical)" }}
        >
          {problems}
        </span>
      ) : null}
    </div>
  );
}
