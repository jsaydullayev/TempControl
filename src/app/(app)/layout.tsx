import { getTranslations } from "next-intl/server";
import { requestNow } from "@/lib/now";

import { relativeTimeParts } from "@/lib/format";
import type { Severity } from "@/lib/types";
import type { AlertItem } from "@/components/alerts/alert-bell";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireSession, visibleBuildings } from "@/server/auth/dal";
import { bellAlerts, unseenCount } from "@/server/dal/alerts";
import { currentBuildingIdOrNull } from "@/server/dal/view-selection";

const SEVERITY_COLOR: Record<Severity, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authorisation is re-run here AND in every page below — the layout is not a gate.
  const session = await requireSession();
  const t = await getTranslations();

  const buildings = visibleBuildings(session);
  // A fresh install has no buildings; the shell must still render so the admin
  // can reach the page that creates the first one.
  const buildingId = await currentBuildingIdOrNull(session);

  // The bell reads the alert table, not the live sensor values: an alert is a
  // recorded event with a history, and the badge counts what has not been read.
  const [rows, unseen] = buildingId
    ? await Promise.all([bellAlerts(session, buildingId), unseenCount(session, buildingId)])
    : [[], 0];

  const now = requestNow();
  const alerts: AlertItem[] = rows.map((row) => {
    const rel = relativeTimeParts(row.openedAt, now);
    const label =
      row.kind === "offline"
        ? t("status.offline")
        : row.kind === "battery"
          ? t("status.lowBattery")
          : row.kind === "temp"
            ? t(row.direction === "below" ? "status.tooCold" : "status.tooHot")
            : t(row.direction === "below" ? "status.tooDry" : "status.tooHumid");

    return {
      id: row.sensorId,
      name: row.sensorName,
      room: row.roomName,
      label,
      color: SEVERITY_COLOR[row.severity],
      when: rel ? t(`time.${rel.key}`, { count: rel.count }) : t("sensors.never"),
    };
  });

  const items: NavItem[] = [
    { href: "/", labelKey: "dashboard", label: t("nav.dashboard") },
    { href: "/sensors", labelKey: "sensors", label: t("nav.sensors") },
    { href: "/history", labelKey: "history", label: t("nav.history") },
  ];

  if (session.isAdmin) {
    items.push({ href: "/admin", labelKey: "admin", label: t("nav.admin") });
  }

  const scopeTitle = session.isAdmin
    ? t("nav.admin")
    : (buildings[0]?.name ?? t("nav.building"));
  const scopeSubtitle = session.isAdmin ? t("auth.allBuildings") : t("auth.buildingSession");

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        items={items}
        appName={t("common.appName")}
        scopeTitle={scopeTitle}
        scopeSubtitle={scopeSubtitle}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          buildings={buildings}
          currentBuildingId={buildingId ?? ""}
          isAdmin={session.isAdmin}
          alerts={alerts}
          unseen={unseen}
        />
        {/* Extra bottom padding on mobile so the tab bar never covers content. */}
        <main className="flex-1 px-4 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <MobileNav items={items} alertsLabel={t("nav.alerts")} unseen={unseen} />
    </div>
  );
}
