import { getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/server/auth/dal";
import { recentAudit } from "@/server/dal/admin";

/**
 * Who changed what, newest first.
 *
 * Read-only on purpose: a log that can be edited from the app it audits is not
 * evidence of anything.
 */
export default async function AuditPage() {
  await requireAdmin();
  const t = await getTranslations();
  const locale = await getLocale();

  const rows = await recentAudit(150);

  const fmt = new Intl.DateTimeFormat(locale === "uz" ? "en-GB" : locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.audit")}
        backHref="/admin"
        backLabel={t("common.back")}
      />

      {rows.length === 0 ? (
        <p
          className="rounded-xl px-6 py-12 text-center text-sm"
          style={{ border: "1px dashed var(--axis)", color: "var(--ink-muted)" }}
        >
          {t("common.noData")}
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr style={{ color: "var(--ink-muted)" }}>
                <Th>{t("history.time")}</Th>
                <Th>{t("admin.actor")}</Th>
                <Th>{t("admin.action")}</Th>
                <Th>{t("admin.entity")}</Th>
                <Th>{t("admin.details")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="tnum px-4 py-2.5" style={{ color: "var(--ink-secondary)" }}>
                    {fmt.format(row.at)}
                  </td>
                  <td className="px-4 py-2.5">{row.actorKind}</td>
                  <td className="px-4 py-2.5">
                    <span style={{ color: colorFor(row.action) }}>{row.action}</span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink-secondary)" }}>
                    {row.entity}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                    {describe(row.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Destructive actions read differently from additive ones at a glance. */
function colorFor(action: string): string {
  if (action === "deactivate" || action === "unbind") return "var(--status-serious)";
  if (action === "create" || action === "bind" || action === "rebind") return "var(--status-good)";
  return "var(--ink-primary)";
}

/** The password action deliberately records no value, so there is nothing to show. */
function describe(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "—";
  const entries = Object.entries(meta as Record<string, unknown>)
    .filter(([key]) => key !== "password")
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length > 0 ? entries.join(" · ") : "—";
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-left text-xs font-medium">
      {children}
    </th>
  );
}
