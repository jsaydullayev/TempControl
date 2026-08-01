import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Building2,
  ChevronRight,
  Cpu,
  LayoutGrid,
  Plug,
  ScrollText,
  SlidersHorizontal,
  LayoutDashboard,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/server/auth/dal";

export default async function AdminPage() {
  // A building session 404s here — it must not learn the admin area exists.
  await requireAdmin();
  const t = await getTranslations();

  const sections = [
    {
      href: "/admin/overview",
      title: t("admin.overview"),
      body: t("admin.overviewBody"),
      icon: <LayoutDashboard size={18} aria-hidden />,
    },
    {
      href: "/admin/buildings",
      title: t("admin.buildings"),
      body: t("admin.buildingsBody"),
      icon: <Building2 size={18} aria-hidden />,
    },
    {
      href: "/admin/structure",
      title: t("admin.structure"),
      body: t("admin.structureBody"),
      icon: <LayoutGrid size={18} aria-hidden />,
    },
    {
      href: "/admin/sensors",
      title: t("admin.sensors"),
      body: t("admin.sensorsBody"),
      icon: <Cpu size={18} aria-hidden />,
    },
    {
      href: "/admin/thresholds",
      title: t("admin.thresholds"),
      body: t("admin.thresholdsBody"),
      icon: <SlidersHorizontal size={18} aria-hidden />,
    },
    {
      href: "/admin/integrations",
      title: t("admin.integrations"),
      body: t("admin.integrationsBody"),
      icon: <Plug size={18} aria-hidden />,
    },
    {
      href: "/admin/audit",
      title: t("admin.audit"),
      body: t("admin.auditBody"),
      icon: <ScrollText size={18} aria-hidden />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.title")}
        backHref="/"
        backLabel={t("common.back")}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
          >
            <span style={{ color: "var(--series-1)" }}>{section.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{section.title}</span>
              <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                {section.body}
              </span>
            </span>
            <ChevronRight size={16} style={{ color: "var(--ink-muted)" }} aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
