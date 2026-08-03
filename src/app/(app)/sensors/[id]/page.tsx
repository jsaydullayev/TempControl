import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requestNow } from "@/lib/now";

import { formatHumidity, formatTemp, relativeTimeParts } from "@/lib/format";
import { summariseSensor } from "@/lib/sensor-status";
import type { Reading } from "@/lib/types";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TimeSeriesChart } from "@/components/charts/time-series";
import { SegmentedLinks } from "@/components/layout/segmented-links";
import { StatusChip } from "@/components/sensors/status-chip";
import { requireSession } from "@/server/auth/dal";
import { getSensorHistory, getSensorState, locationsOf } from "@/server/dal/sensors";

const RANGES = {
  "1h": { spanMs: 3_600_000, gapMs: 15 * 60_000, ticks: 6 },
  "24h": { spanMs: 86_400_000, gapMs: 60 * 60_000, ticks: 6 },
  "7d": { spanMs: 7 * 86_400_000, gapMs: 6 * 3_600_000, ticks: 7 },
  "30d": { spanMs: 30 * 86_400_000, gapMs: 24 * 3_600_000, ticks: 6 },
  "90d": { spanMs: 90 * 86_400_000, gapMs: 48 * 3_600_000, ticks: 6 },
} as const;

type RangeKey = keyof typeof RANGES;

export default async function SensorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; table?: string }>;
}) {
  const session = await requireSession();
  const t = await getTranslations();
  const locale = await getLocale();

  // Out-of-scope ids 404 here — the DAL does not distinguish them from unknown ids.
  const { id } = await params;
  const state = await getSensorState(session, id);

  const sp = await searchParams;
  const range: RangeKey = sp.range && sp.range in RANGES ? (sp.range as RangeKey) : "24h";
  const showTable = sp.table === "1";

  const now = requestNow();
  const cfg = RANGES[range];
  const history = await getSensorHistory(session, id, now - cfg.spanMs, now);
  const points = downsample(history, 500);

  const summary = summariseSensor(state);
  // The limits this sensor is actually judged against, not the global default.
  const band = state.thresholds;
  const loc = (await locationsOf([state.sensor.roomId])).get(state.sensor.roomId) ?? {
    room: "",
    department: "",
    floor: "",
  };
  const rel = relativeTimeParts(state.lastSeen, now);
  const seen = rel ? t(`time.${rel.key}`, { count: rel.count }) : t("sensors.never");

  const href = (next: Partial<{ range: RangeKey; table: boolean }>) => {
    const r = next.range ?? range;
    const tb = next.table ?? showTable;
    const parts = [`range=${r}`];
    if (tb) parts.push("table=1");
    return `/sensors/${id}?${parts.join("&")}`;
  };

  const ticks = tickMarks(points, cfg.ticks, locale, range);

  return (
    <div className="flex flex-col gap-5">
      {/* Same back affordance as every other panel — see PageHeader. */}
      <div className="flex items-start gap-3">
        <Link
          href="/sensors"
          aria-label={t("common.back")}
          title={t("common.back")}
          className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            border: "1px solid var(--hairline)",
            background: "var(--surface-1)",
            color: "var(--ink-secondary)",
          }}
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>

        <div>
          <p
            className="text-[11px] font-medium tracking-[0.08em] uppercase"
            style={{ color: "var(--ink-muted)" }}
          >
            {loc.room}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{state.sensor.name}</h1>
            <StatusChip kind={summary.kind} label={t(`status.${summary.labelKey}`)} />
          </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label={t("sensors.temperature")}
          value={state.latest ? formatTemp(state.latest.tempC) : "—"}
          unit="°C"
          accent={summary.severity !== "good" && !summary.offline ? `var(--status-${summary.severity})` : undefined}
          note={`${t("plan.norm")} ${band.temp.min}–${band.temp.max} °C`}
        />
        <Kpi
          label={t("sensors.humidity")}
          value={state.latest ? formatHumidity(state.latest.humidity) : "—"}
          unit="%"
          note={`${t("plan.norm")} ${band.hum.min}–${band.hum.max} %`}
        />
        <Kpi
          label={t("sensors.battery")}
          value={state.latest ? String(state.latest.battery) : "—"}
          unit="%"
          accent={summary.lowBattery ? "var(--status-warning)" : undefined}
          note={seen}
        />
      </section>

      <section
        className="rounded-xl"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <InfoRow label={t("sensors.room")} value={loc.room} />
        <InfoRow label={t("nav.department")} value={loc.department} />
        <InfoRow label={t("nav.floor")} value={loc.floor} />
        <InfoRow
          label={t("sensors.status")}
          value={<StatusChip kind={summary.kind} label={t(`status.${summary.labelKey}`)} />}
        />
        <InfoRow label={t("sensors.lastSeen")} value={seen} last />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className="text-[11px] font-medium tracking-[0.08em] uppercase"
          style={{ color: "var(--ink-muted)" }}
        >
          {t("history.period")}
        </span>
        <SegmentedLinks
          ariaLabel={t("history.period")}
          current={range}
          items={(Object.keys(RANGES) as RangeKey[]).map((key) => ({
            key,
            label: t(`history.range_${key}`),
            href: href({ range: key }),
          }))}
        />
      </div>

      <ChartFrame
        title={t("history.tempTitle")}
        legend={[
          { label: state.sensor.name, color: "var(--series-1)" },
          {
            label: `${t("plan.norm")} ${band.temp.min}–${band.temp.max} °C`,
            color: "color-mix(in srgb, var(--status-good) 45%, transparent)",
            block: true,
          },
        ]}
        toggleHref={href({ table: !showTable })}
        showingTable={showTable}
        chartLabel={t("history.chart")}
        tableLabel={t("history.table")}
      >
        {points.length < 2 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("common.noData")}
          </p>
        ) : showTable ? (
          <ReadingTable points={points} locale={locale} labels={{
            time: t("history.time"),
            temp: t("sensors.temperature"),
            hum: t("sensors.humidity"),
          }} />
        ) : (
          <TimeSeriesChart
            points={points}
            field="tempC"
            color="var(--series-1)"
            band={{ min: band.temp.min, max: band.temp.max }}
            unit="°C"
            maxLabel={t("history.max")}
            minLabel={t("history.min")}
            gapMs={cfg.gapMs}
            ticks={ticks}
            ariaLabel={`${state.sensor.name} — ${t("history.tempTitle")}`}
          />
        )}
      </ChartFrame>

      {/* Humidity gets its own frame — never a second y-axis on the same plot. */}
      <ChartFrame
        title={t("history.humTitle")}
        legend={[
          { label: state.sensor.name, color: "var(--series-3)" },
          {
            label: `${t("plan.norm")} ${band.hum.min}–${band.hum.max} %`,
            color: "color-mix(in srgb, var(--status-good) 45%, transparent)",
            block: true,
          },
        ]}
        toggleHref={href({ table: !showTable })}
        showingTable={showTable}
        chartLabel={t("history.chart")}
        tableLabel={t("history.table")}
      >
        {points.length < 2 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("common.noData")}
          </p>
        ) : showTable ? null : (
          <TimeSeriesChart
            points={points}
            field="humidity"
            color="var(--series-3)"
            band={{ min: band.hum.min, max: band.hum.max }}
            unit="%"
            maxLabel={t("history.max")}
            minLabel={t("history.min")}
            gapMs={cfg.gapMs}
            ticks={ticks}
            ariaLabel={`${state.sensor.name} — ${t("history.humTitle")}`}
          />
        )}
      </ChartFrame>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  note,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <p
        className="text-[11px] font-medium tracking-[0.08em] uppercase"
        style={{ color: "var(--ink-muted)" }}
      >
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span
          className="text-3xl leading-none font-semibold tracking-tight"
          style={{ color: accent ?? "var(--ink-primary)" }}
        >
          {value}
        </span>
        <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          {unit}
        </span>
      </p>
      <p className="mt-1.5 text-xs" style={{ color: "var(--ink-muted)" }}>
        {note}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ borderBottom: last ? undefined : "1px solid var(--hairline)" }}
    >
      <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ReadingTable({
  points,
  locale,
  labels,
}: {
  points: Reading[];
  locale: string;
  labels: { time: string; temp: string; hum: string };
}) {
  // Newest first: the reason someone opens the table is usually "what just happened".
  const rows = [...points].reverse().slice(0, 200);
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ color: "var(--ink-muted)" }}>
            <th className="px-2 py-2 text-left text-xs font-medium">{labels.time}</th>
            <th className="px-2 py-2 text-right text-xs font-medium">{labels.temp}</th>
            <th className="px-2 py-2 text-right text-xs font-medium">{labels.hum}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.ts} style={{ borderTop: "1px solid var(--hairline)" }}>
              <td className="tnum px-2 py-1.5" style={{ color: "var(--ink-secondary)" }}>
                {new Intl.DateTimeFormat(locale === "uz" ? "en-GB" : locale, {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(p.ts)}
              </td>
              <td className="tnum px-2 py-1.5 text-right">{formatTemp(p.tempC)} °C</td>
              <td className="tnum px-2 py-1.5 text-right">{formatHumidity(p.humidity)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Keep every gap intact: thin by index, never merge across a silence. */
function downsample(points: Reading[], target: number): Reading[] {
  if (points.length <= target) return points;
  const step = Math.ceil(points.length / target);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

function tickMarks(
  points: Reading[],
  count: number,
  locale: string,
  range: RangeKey,
): { at: number; label: string }[] {
  if (points.length < 2) return [];
  const first = points[0].ts;
  const last = points[points.length - 1].ts;
  const fmt = new Intl.DateTimeFormat(locale === "uz" ? "en-GB" : locale,
    range === "1h" || range === "24h"
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit" });

  return Array.from({ length: count }, (_, i) => {
    const at = first + ((last - first) * i) / (count - 1);
    return { at, label: fmt.format(at) };
  });
}
