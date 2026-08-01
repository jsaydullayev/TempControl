"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Shield, Thermometer, Cpu } from "lucide-react";

export type NavKey = "dashboard" | "sensors" | "history" | "admin";

export interface NavItem {
  href: string;
  labelKey: NavKey;
  label: string;
}

const ICONS: Record<NavKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  sensors: Cpu,
  history: LineChart,
  admin: Shield,
};

interface Props {
  items: NavItem[];
  appName: string;
  /** Who this session belongs to — a building, or the administrator. */
  scopeTitle: string;
  scopeSubtitle: string;
}

export function Sidebar({ items, appName, scopeTitle, scopeSubtitle }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-[220px] shrink-0 flex-col border-r px-3 py-4 lg:flex"
      style={{ borderColor: "var(--hairline)", background: "var(--plane)" }}
    >
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <Thermometer size={18} style={{ color: "var(--series-1)" }} aria-hidden />
        <span className="text-[15px] font-semibold tracking-tight">{appName}</span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.labelKey];
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
              style={{
                background: active ? "var(--surface-1)" : "transparent",
                color: active ? "var(--ink-primary)" : "var(--ink-secondary)",
                fontWeight: active ? 500 : 400,
              }}
            >
              <Icon size={16} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Whose session this is, pinned to the bottom rail. */}
      <div
        className="mt-auto border-t px-2 pt-3"
        style={{ borderColor: "var(--hairline)" }}
      >
        <p className="truncate text-sm font-medium">{scopeTitle}</p>
        <p
          className="truncate text-[11px] tracking-wide uppercase"
          style={{ color: "var(--ink-muted)" }}
        >
          {scopeSubtitle}
        </p>
      </div>
    </aside>
  );
}
