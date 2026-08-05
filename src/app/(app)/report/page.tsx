import { getLocale, getTranslations } from "next-intl/server";

import { requestNow } from "@/lib/now";
import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/report/print-button";
import { SegmentedLinks } from "@/components/layout/segmented-links";
import { requireSession, visibleBuildings } from "@/server/auth/dal";
import { buildReport, type ReportCell, type ReportRow } from "@/server/dal/report";
import { currentBuildingIdOrNull } from "@/server/dal/view-selection";

/**
 * Printable monitoring report.
 *
 * One row per sensor, one column per bucket, sized so the whole period lands on
 * a single sheet — that is the point of the format. Thirty daily columns is
 * dense but readable in landscape; a list of readings would be hundreds of
 * pages and would answer no question a reader actually has.
 */

const RANGES = {
  "1d": { days: 1, bucketMs: 3_600_000 },   // 24 hourly columns
  "7d": { days: 7, bucketMs: 86_400_000 },  // 7 daily columns
  "30d": { days: 30, bucketMs: 86_400_000 },
} as const;

type RangeKey = keyof typeof RANGES;

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireSession();
  const t = await getTranslations();
  const locale = await getLocale();

  if (visibleBuildings(session).length === 0) {
    return (
      <NoBuildings
        title={t("common.noBuildings")}
        body={t("common.noBuildingsBody")}
        action={t("common.createBuilding")}
      />
    );
  }

  const buildingId = await currentBuildingIdOrNull(session);
  if (!buildingId) {
    return (
      <NoBuildings
        title={t("common.noBuildings")}
        body={t("common.noBuildingsBody")}
        action={t("common.createBuilding")}
      />
    );
  }

  const building = visibleBuildings(session).find((b) => b.id === buildingId);
  const sp = await searchParams;
  const range: RangeKey = sp.range && sp.range in RANGES ? (sp.range as RangeKey) : "7d";
  const cfg = RANGES[range];

  const now = requestNow();
  const report = await buildReport(
    session,
    buildingId,
    now - cfg.days * 86_400_000,
    now,
    cfg.bucketMs,
  );

  const hourly = cfg.bucketMs < 86_400_000;
  const header = report.axis.map((ts) =>
    hourly
      ? new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", hour12: false })
      : new Date(ts).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
  );

  const breached = report.rows.filter((r) => r.breaches > 0).length;
  const printedAt = new Date(now).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          eyebrow={building?.name ?? ""}
          title={t("report.title")}
          backHref="/"
          backLabel={t("common.back")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <SegmentedLinks
          ariaLabel={t("history.period")}
          current={range}
          items={(Object.keys(RANGES) as RangeKey[]).map((key) => ({
            key,
            label: t(`report.range_${key}`),
            href: `/report?range=${key}`,
          }))}
        />
        <PrintButton label={t("report.download")} />
      </div>

      {/* Only appears on paper: the screen already shows all of this. */}
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">
          {building?.name} — {t("report.title")}
        </h1>
        <p className="text-[10px]">
          {t(`report.range_${range}`)} · {t("report.printedAt")} {printedAt}
        </p>
      </div>

      <section
        className="overflow-x-auto rounded-xl print:overflow-visible print:rounded-none"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <table className="w-full border-collapse text-xs print:text-[7pt]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
              <Th sticky>{t("sensors.name")}</Th>
              <Th>{t("report.limits")}</Th>
              {header.map((label, i) => (
                <Th key={report.axis[i]} center>
                  {label}
                </Th>
              ))}
              <Th center>{t("report.overall")}</Th>
              <Th center>{t("report.breaches")}</Th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={header.length + 4} className="px-3 py-6 text-center" style={{ color: "var(--ink-muted)" }}>
                  {t("common.noData")}
                </td>
              </tr>
            ) : (
              report.rows.map((row) => <Row key={row.sensorId} row={row} />)
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs print:text-[7pt]" style={{ color: "var(--ink-muted)" }}>
        {t("report.legend")} · {t("report.breachedSensors", { count: breached })}
      </p>
    </div>
  );
}

function Row({ row }: { row: ReportRow }) {
  return (
    <tr style={{ borderTop: "1px solid var(--hairline)" }}>
      <td className="px-2 py-1 whitespace-nowrap">
        <span className="font-medium">{row.name}</span>
        <span className="ml-1 print:hidden" style={{ color: "var(--ink-muted)" }}>
          {row.department}
        </span>
      </td>
      <td className="tnum px-2 py-1 whitespace-nowrap" style={{ color: "var(--ink-muted)" }}>
        {row.limits.min}–{row.limits.max}
      </td>

      {row.cells.map((cell) => (
        <Cell key={cell.ts} cell={cell} limits={row.limits} />
      ))}

      <td className="tnum px-2 py-1 text-center whitespace-nowrap">
        {row.overall.min === null ? "—" : `${row.overall.min}–${row.overall.max}`}
      </td>
      <td
        className="tnum px-2 py-1 text-center font-medium"
        style={{ color: row.breaches > 0 ? "var(--status-critical)" : "var(--ink-muted)" }}
      >
        {row.breaches || "—"}
      </td>
    </tr>
  );
}

/**
 * A breach is marked by BOTH colour and a symbol — printed reports are often
 * black and white, and a red cell that greys out carries no meaning at all.
 */
function Cell({ cell, limits }: { cell: ReportCell; limits: { min: number; max: number } }) {
  if (cell.min === null) {
    return (
      <td className="px-1 py-1 text-center" style={{ color: "var(--ink-muted)" }}>
        ·
      </td>
    );
  }

  const low = cell.min < limits.min;
  const high = (cell.max as number) > limits.max;
  const bad = low || high;

  /*
   * Max above min, stacked.
   *
   * Written inline as "23.4–24.6" a cell needs roughly 18 mm, and thirty of
   * those are twice the width of a landscape A4. With `table-layout: fixed`
   * the surplus is not scrolled but CLIPPED — the report would quietly show
   * half of each number. Two short lines fit the same information in 6 mm.
   */
  return (
    <td
      className="tnum px-1 py-0.5 text-center whitespace-nowrap"
      style={{
        color: bad ? "var(--status-critical)" : "var(--ink-primary)",
        fontWeight: bad ? 600 : 400,
      }}
      title={`${cell.min}–${cell.max} °C`}
    >
      <span className="block leading-tight">
        {high ? "▲" : ""}
        {cell.max}
      </span>
      {cell.min !== cell.max ? (
        <span className="block leading-tight" style={{ opacity: 0.75 }}>
          {low ? "▼" : ""}
          {cell.min}
        </span>
      ) : null}
    </td>
  );
}

function Th({
  children,
  center,
  sticky,
}: {
  children: React.ReactNode;
  center?: boolean;
  sticky?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`px-2 py-1.5 font-medium whitespace-nowrap ${center ? "text-center" : "text-left"} ${
        sticky ? "sticky left-0 print:static" : ""
      }`}
      style={{ color: "var(--ink-muted)", background: sticky ? "var(--surface-1)" : undefined }}
    >
      {children}
    </th>
  );
}
