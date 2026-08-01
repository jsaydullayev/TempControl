"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutDashboard, LineChart, Shield, Cpu } from "lucide-react";

import type { NavItem, NavKey } from "@/components/layout/sidebar";

const ICONS: Record<NavKey | "alerts", typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  sensors: Cpu,
  history: LineChart,
  admin: Shield,
  alerts: Bell,
};

/**
 * Bottom tab bar for narrow screens, where the sidebar is hidden.
 *
 * Alerts get a tab of their own here even though the desktop reaches them
 * through the bell: a dropdown anchored to a 36px button is not a touch target.
 */
export function MobileNav({ items, alertsLabel, unseen }: {
  items: NavItem[];
  alertsLabel: string;
  unseen: number;
}) {
  const pathname = usePathname();

  const tabs = [
    ...items.map((item) => ({ href: item.href, label: item.label, key: item.labelKey as NavKey | "alerts" })),
    { href: "/alerts", label: alertsLabel, key: "alerts" as const },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex lg:hidden"
      style={{
        background: "var(--surface-1)",
        borderTop: "1px solid var(--hairline)",
        // Keeps the bar clear of the iOS home indicator.
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map((tab) => {
        const Icon = ICONS[tab.key];
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]"
            style={{
              color: active ? "var(--series-1)" : "var(--ink-muted)",
              fontWeight: active ? 500 : 400,
            }}
          >
            <span className="relative">
              <Icon size={20} aria-hidden />
              {tab.key === "alerts" && unseen > 0 ? (
                <span
                  className="absolute -top-1 -right-2 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                  style={{ background: "var(--status-critical)" }}
                >
                  {unseen > 9 ? "9+" : unseen}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate px-1">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
