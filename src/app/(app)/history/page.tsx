import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FileDown, LineChart } from "lucide-react";
import { requestNow } from "@/lib/now";

import { formatHumidity, formatTemp } from "@/lib/format";
import { DEFAULT_THRESHOLDS } from "@/lib/types";
import { rulesFor } from "@/server/alerts/rules";
import { MultiSeriesChart, type Series } from "@/components/charts/multi-series-chart";
import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedLinks } from "@/components/layout/segmented-links";
import { requireSession, visibleBuildings } from "@/server/auth/dal";
import { listSensorOptions, scopeSensorIds, seriesFor, statsFor } from "@/server/dal/history";
import { currentBuildingId } from "@/server/dal/view-selection";

/**
 * Comparison view: several sensors over a range, on one shared axis.
 *
 * Capped at eight series because that is the size of the categorical palette —
 * a ninth colour would be indistinguishable from one already on screen.
 */
const MAX_SERIES = 8;

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

const RANGES = {
  "24h": { spanMs: 86_400_000, gapMs: 60 * 60_000, ticks: 6 },
  "7d": { spanMs: 7 * 86_400_000, gapMs: 6 * 3_600_000, ticks: 7 },
  "30d": { spanMs: 30 * 86_400_000, gapMs: 24 * 3_600_000, ticks: 6 },
  "90d": { spanMs: 90 * 86_400_000, gapMs: 48 * 3_600_000, ticks: 6 },
} as const;

type RangeKey = keyof typeof RANGES;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; s?: string | string[] }>;
}) {
  const session = await requireSession();
  const t = await getTranslations();
  const locale = await getLocale();

  const params = await searchParams;
  const range: RangeKey = params.range && params.range in RANGES ? (params.range as RangeKey) : "24h";
  const cfg = RANGES[range];

  if (visibleBuildings(session).length === 0) {
    return (
      <NoBuildings
        title={t("common.noBuildings")}
        body={t("common.noBuildingsBody")}
        action={t("common.createBuilding")}
      />
    );
  }

  const buildingId = await currentBuildingId(session);
  const building = visibleBuildings(session).find((b) => b.id === buildingId);
  const options = await listSensorOptions(session, buildingId);

  // Ids come from the URL, so they are scoped before anything is read.
  const requested = params.s ? (Array.isArray(params.s) ? params.s : [params.s]) : [];
  const selected = (await scopeSensorIds(session, buildingId, requested)).slice(0, MAX_SERIES);

  // Nothing chosen yet: show the first few so the page is never blank.
  const active = selected.length > 0 ? selected : options.slice(0, 3).map((o) => o.id);

  const now = requestNow();
  const from = now - cfg.spanMs;

  const [points, stats] = await Promise.all([
    seriesFor(active, from, now),
    statsFor(active, from, now),
  ]);

  const nameOf = new Map(options.map((o) => [o.id, o.name]));
  const series: Series[] = active.map((id, i) => ({
    id,
    label: nameOf.get(id) ?? "",
    color: SERIES_COLORS[i],
    points: points.get(id) ?? [],
  }));

  /*
   * The limits the ADMIN configured, resolved exactly as the alert engine does.
   *
   * A single band can only be drawn when every compared sensor obeys the same
   * rule. Comparing a fridge at 2–8 with a room at 18–26 under one band would
   * paint the fridge's normal readings as a breach — so when they differ the
   * band is dropped and the table carries the judgement instead, per row.
   */
  const rules = await rulesFor(buildingId, active);
  const key = (m: "temp" | "hum") =>
    active.map((id) => {
      const r = rules.get(id);
      return r ? `${r[m].min}-${r[m].max}` : "";
    });
  const shared = (m: "temp" | "hum") => new Set(key(m)).size === 1;

  /** Each row is judged by ITS OWN rule, even when the chart shows no band. */
  const limitOf = (sensorId: string, metric: "temp" | "hum") => {
    const r = rules.get(sensorId);
    return r
      ? { min: r[metric].min, max: r[metric].max }
      : { min: DEFAULT_THRESHOLDS[metric].min, max: DEFAULT_THRESHOLDS[metric].max };
  };

  const first = rules.get(active[0]);
  const tempBand = shared("temp") && first ? { min: first.temp.min, max: first.temp.max } : null;
  const humBand = shared("hum") && first ? { min: first.hum.min, max: first.hum.max } : null;
  const mixedLimits = !shared("temp") || !shared("hum");

  const ticks = tickMarks(series, cfg.ticks, locale, range);
  const hasData = series.some((s) => s.points.length >= 2);

  const rangeHref = (key: RangeKey) =>
    `/history?${new URLSearchParams([["range", key], ...active.map((id) => ["s", id])]).toString()}`;

  const toggleHref = (id: string) => {
    const next = active.includes(id) ? active.filter((x) => x !== id) : [...active, id];
    const capped = next.slice(0, MAX_SERIES);
    return `/history?${new URLSearchParams([["range", range], ...capped.map((x) => ["s", x])]).toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          eyebrow={building?.name ?? ""}
          title={t("nav.history")}
          backHref="/"
          backLabel={t("common.back")}
        />
        {/* The printable twin of this page: same data, one sheet, all sensors. */}
        <Link
          href="/report"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium"
          style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
        >
          <FileDown size={15} aria-hidden />
          {t("report.open")}
        </Link>
      </div>

      {/* One filter row above everything it scopes. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              href: rangeHref(key),
            }))}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const index = active.indexOf(option.id);
            const on = index >= 0;
            return (
              <a
                key={option.id}
                href={toggleHref(option.id)}
                aria-current={on ? "true" : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm"
                style={{
                  background: on ? "var(--surface-2)" : "transparent",
                  border: `1px solid ${on ? "var(--hairline)" : "transparent"}`,
                  color: on ? "var(--ink-primary)" : "var(--ink-muted)",
                }}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: on ? SERIES_COLORS[index] : "transparent",
                    border: on ? undefined : "1.5px solid var(--ink-muted)",
                  }}
                />
                {option.name}
              </a>
            );
          })}
        </div>

        {active.length >= MAX_SERIES ? (
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            {t("history.maxSeries", { count: MAX_SERIES })}
          </p>
        ) : null}
      </div>

      {!hasData ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl px-6 py-16 text-center"
          style={{ background: "var(--surface-1)", border: "1px dashed var(--axis)" }}
        >
          <LineChart size={22} style={{ color: "var(--ink-muted)" }} aria-hidden />
          <p className="font-medium">{t("common.noData")}</p>
          <p className="max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("history.empty")}
          </p>
        </div>
      ) : (
        <>
          {mixedLimits ? (
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {t("history.mixedLimits")}
            </p>
          ) : null}

          <Frame title={t("history.tempTitle")} series={series}>
            <MultiSeriesChart
              series={series}
              field="tempC"
              band={tempBand}
              unit="°C"
              maxLabel={t("history.max")}
              minLabel={t("history.min")}
              gapMs={cfg.gapMs}
              ticks={ticks}
              ariaLabel={t("history.tempTitle")}
            />
          </Frame>

          {/* Humidity gets its own frame — never a second axis on the same plot. */}
          <Frame title={t("history.humTitle")} series={series}>
            <MultiSeriesChart
              series={series}
              field="humidity"
              band={humBand}
              unit="%"
              maxLabel={t("history.max")}
              minLabel={t("history.min")}
              gapMs={cfg.gapMs}
              ticks={ticks}
              ariaLabel={t("history.humTitle")}
            />
          </Frame>

          <section
            className="overflow-x-auto rounded-xl"
            style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
          >
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr style={{ color: "var(--ink-muted)" }}>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium">
                    {t("alerts.sensor")}
                  </th>
                  {[t("history.min"), t("dashboard.avgTemp"), t("history.max")].map((label) => (
                    <th key={`t-${label}`} scope="col" className="px-4 py-3 text-right text-xs font-medium">
                      {label} °C
                    </th>
                  ))}
                  {[t("history.min"), t("dashboard.avgTemp"), t("history.max")].map((label) => (
                    <th key={`h-${label}`} scope="col" className="px-4 py-3 text-right text-xs font-medium">
                      {label} %
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((row, i) => (
                  <tr key={row.sensorId} style={{ borderTop: "1px solid var(--hairline)" }}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ background: SERIES_COLORS[i] }}
                        />
                        {row.name || nameOf.get(row.sensorId)}
                      </span>
                    </td>
                    <Num v={row.tempMin} fmt={formatTemp} low={limitOf(row.sensorId, "temp").min} />
                    <Num v={row.tempAvg} fmt={formatTemp} />
                    <Num v={row.tempMax} fmt={formatTemp} high={limitOf(row.sensorId, "temp").max} />
                    <Num v={row.humMin} fmt={formatHumidity} low={limitOf(row.sensorId, "hum").min} />
                    <Num v={row.humAvg} fmt={formatHumidity} />
                    <Num v={row.humMax} fmt={formatHumidity} high={limitOf(row.sensorId, "hum").max} />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            {t("history.outOfRange")}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Marks a value that left its limits.
 *
 * Colour is doubled by the ▼ / ▲ arrow: the same table is printed, read on a
 * phone in daylight and looked at by people who do not separate red from grey.
 */
function Num({
  v,
  fmt,
  low,
  high,
}: {
  v: number | null;
  fmt: (n: number) => string;
  /** Breach when the value falls below this. */
  low?: number;
  /** Breach when the value rises above this. */
  high?: number;
}) {
  const bad =
    v !== null && ((low !== undefined && v < low) || (high !== undefined && v > high));

  return (
    <td
      className="tnum px-4 py-3 text-right"
      style={bad ? { color: "var(--status-critical)", fontWeight: 600 } : undefined}
    >
      {bad ? (low !== undefined ? "▼ " : "▲ ") : ""}
      {v === null ? "—" : fmt(v)}
    </td>
  );
}

/** Chart container with the legend — identity is never colour alone. */
function Frame({
  title,
  series,
  children,
}: {
  title: string;
  series: Series[];
  children: React.ReactNode;
}) {
  return (
    <section
      className="flex flex-col gap-4 rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-sm font-medium">{title}</h2>
        <ul className="flex flex-wrap items-center gap-3">
          {series.map((s) => (
            <li
              key={s.id}
              className="inline-flex items-center gap-1.5 text-xs"
              style={{ color: "var(--ink-muted)" }}
            >
              <span
                aria-hidden
                style={{ width: 14, height: 2, borderRadius: 2, background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      {children}
    </section>
  );
}

function tickMarks(
  series: Series[],
  count: number,
  locale: string,
  range: RangeKey,
): { at: number; label: string }[] {
  const times = series.flatMap((s) => s.points.map((p) => p.ts));
  if (times.length < 2) return [];

  const first = Math.min(...times);
  const last = Math.max(...times);
  const fmt = new Intl.DateTimeFormat(
    locale === "uz" ? "en-GB" : locale,
    range === "24h" ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" },
  );

  return Array.from({ length: count }, (_, i) => {
    const at = first + ((last - first) * i) / (count - 1);
    return { at, label: fmt.format(at) };
  });
}
