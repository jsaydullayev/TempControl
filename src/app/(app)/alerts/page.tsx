import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BellOff, Check } from "lucide-react";
import { requestNow } from "@/lib/now";

import { relativeTimeParts } from "@/lib/format";
import type { Severity } from "@/lib/types";
import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedLinks } from "@/components/layout/segmented-links";
import { requireSession, visibleBuildings } from "@/server/auth/dal";
import { listAlerts, type AlertRow } from "@/server/dal/alerts";
import { currentBuildingId } from "@/server/dal/view-selection";
import { acknowledgeAction } from "@/app/(app)/alerts/actions";

const COLOR: Record<Severity, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const session = await requireSession();
  const t = await getTranslations();

  const showAll = (await searchParams).show === "all";
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

  const rows = await listAlerts(session, buildingId, { includeResolved: showAll });
  const now = requestNow();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={building?.name ?? ""}
        title={t("nav.alerts")}
        backHref="/"
        backLabel={t("common.back")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {rows.length} {t("alerts.records")}
        </p>
        <SegmentedLinks
          ariaLabel={t("alerts.filter")}
          current={showAll ? "all" : "open"}
          items={[
            { key: "open", label: t("alerts.active"), href: "/alerts" },
            { key: "all", label: t("common.all"), href: "/alerts?show=all" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl px-6 py-16 text-center"
          style={{ background: "var(--surface-1)", border: "1px dashed var(--axis)" }}
        >
          <BellOff size={22} style={{ color: "var(--ink-muted)" }} aria-hidden />
          <p className="font-medium">{t("dashboard.allNormal")}</p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr style={{ color: "var(--ink-muted)" }}>
                <Th>{t("alerts.sensor")}</Th>
                <Th>{t("alerts.reason")}</Th>
                <Th align="right">{t("alerts.value")}</Th>
                <Th>{t("alerts.started")}</Th>
                <Th>{t("alerts.duration")}</Th>
                <Th>{t("sensors.status")}</Th>
                <Th align="right"> </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.id} row={row} now={now} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  now,
  t,
}: {
  row: AlertRow;
  now: number;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const started = relativeTimeParts(row.openedAt, now);
  const ended = row.resolvedAt ?? now;
  const duration = relativeTimeParts(row.openedAt, ended);
  const color = COLOR[row.severity];

  const reason =
    row.kind === "offline"
      ? t("status.offline")
      : row.kind === "battery"
        ? t("status.lowBattery")
        : row.kind === "temp"
          ? t(row.direction === "below" ? "status.tooCold" : "status.tooHot")
          : t(row.direction === "below" ? "status.tooDry" : "status.tooHumid");

  const unit = row.kind === "temp" ? " °C" : row.kind === "hum" ? " %" : row.kind === "battery" ? " %" : "";

  return (
    <tr style={{ borderTop: "1px solid var(--hairline)" }}>
      <Td>
        <Link href={`/sensors/${row.sensorId}`} className="font-medium hover:underline">
          {row.sensorName}
        </Link>
        <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
          {row.departmentName} · {row.roomName}
        </span>
      </Td>
      <Td>
        {/* Colour is never alone: the reason is spelled out beside the dot. */}
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color }}
          />
          <span style={{ color }}>{reason}</span>
        </span>
      </Td>
      <Td align="right" numeric>
        {row.value === null ? "—" : `${row.value}${unit}`}
      </Td>
      <Td muted>{started ? t(`time.${started.key}`, { count: started.count }) : "—"}</Td>
      <Td muted>{duration ? t(`time.${duration.key}`, { count: duration.count }) : "—"}</Td>
      <Td>
        <span style={{ color: row.state === "resolved" ? "var(--status-good)" : undefined }}>
          {t(`alerts.state_${row.state}`)}
        </span>
      </Td>
      <Td align="right">
        {row.state === "open" ? (
          <form action={acknowledgeAction}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs"
              style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
            >
              <Check size={12} aria-hidden />
              {t("alerts.acknowledge")}
            </button>
          </form>
        ) : null}
      </Td>
    </tr>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-xs font-medium"
      style={{ textAlign: align ?? "left" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
  numeric,
}: {
  children: React.ReactNode;
  align?: "right";
  muted?: boolean;
  numeric?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 ${numeric ? "tnum" : ""}`}
      style={{
        textAlign: align ?? "left",
        color: muted ? "var(--ink-muted)" : "var(--ink-primary)",
      }}
    >
      {children}
    </td>
  );
}
