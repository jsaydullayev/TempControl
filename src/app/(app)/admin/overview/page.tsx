import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, ChevronRight, CircleSlash, OctagonAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/server/auth/dal";
import { buildingsOverview } from "@/server/dal/admin";

/**
 * Every building on one screen, worst first.
 *
 * The point of this page is triage: an admin opening it should see which
 * building needs them before reading a single name, so the list is ordered by
 * severity rather than alphabetically.
 */
export default async function OverviewPage() {
  await requireAdmin();
  const t = await getTranslations();

  const rows = await buildingsOverview();
  const ranked = [...rows].sort(
    (a, b) =>
      b.criticalAlerts - a.criticalAlerts || b.openAlerts - a.openAlerts || a.name.localeCompare(b.name),
  );

  const totals = rows.reduce(
    (acc, r) => ({
      sensors: acc.sensors + r.sensorCount,
      alerts: acc.alerts + r.openAlerts,
      critical: acc.critical + r.criticalAlerts,
    }),
    { sensors: 0, alerts: 0, critical: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.overview")}
        backHref="/admin"
        backLabel={t("common.back")}
        stats={[
          { label: t("admin.buildings"), value: String(rows.length) },
          { label: t("dashboard.sensorCount"), value: String(totals.sensors) },
          {
            label: t("nav.alerts"),
            value: String(totals.alerts),
            accent: totals.critical > 0 ? "var(--status-critical)" : undefined,
          },
        ]}
      />

      <div className="flex flex-col gap-3">
        {ranked.map((row) => {
          const healthy = row.openAlerts === 0;
          const color = row.criticalAlerts > 0
            ? "var(--status-critical)"
            : row.openAlerts > 0
              ? "var(--status-warning)"
              : "var(--status-good)";

          return (
            <Link
              key={row.id}
              href="/admin/structure"
              className="flex flex-wrap items-center gap-3 rounded-xl p-4"
              style={{
                background: "var(--surface-1)",
                border: `1px solid ${healthy ? "var(--hairline)" : `color-mix(in srgb, ${color} 45%, transparent)`}`,
                opacity: row.isActive ? 1 : 0.6,
              }}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <Building2 size={16} style={{ color: "var(--ink-muted)" }} aria-hidden />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.name}</span>
                <span className="block truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                  {row.sensorCount} {t("dashboard.sensorCount").toLowerCase()}
                  {row.isActive ? "" : ` · ${t("admin.inactive")}`}
                </span>
              </span>

              {/* Counts spell out what the colour means, never the other way round. */}
              {row.criticalAlerts > 0 ? (
                <Badge
                  color="var(--status-critical)"
                  icon={<OctagonAlert size={13} aria-hidden />}
                  label={`${row.criticalAlerts} ${t("status.critical").toLowerCase()}`}
                />
              ) : null}
              {row.offline > 0 ? (
                <Badge
                  color="var(--status-serious)"
                  icon={<CircleSlash size={13} aria-hidden />}
                  label={`${row.offline} ${t("status.offline").toLowerCase()}`}
                />
              ) : null}
              {healthy ? (
                <span className="text-xs" style={{ color: "var(--status-good)" }}>
                  {t("dashboard.allNormal")}
                </span>
              ) : (
                <span className="tnum text-sm font-medium" style={{ color }}>
                  {row.openAlerts}
                </span>
              )}

              <ChevronRight size={16} style={{ color: "var(--ink-muted)" }} aria-hidden />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {icon}
      {label}
    </span>
  );
}
