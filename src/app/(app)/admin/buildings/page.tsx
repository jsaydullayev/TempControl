import { getTranslations } from "next-intl/server";
import { Building2, KeyRound, Plus, Power } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/server/auth/dal";
import { listBuildingsAdmin } from "@/server/dal/admin";
import {
  createBuildingAction,
  setBuildingActiveAction,
  setBuildingPasswordAction,
} from "@/app/(app)/admin/actions";

/**
 * Buildings and their credentials.
 *
 * This is where access itself is created: a building's login and password ARE
 * the account. There is no per-person user anywhere in the system.
 */
export default async function BuildingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations();

  const rows = await listBuildingsAdmin();
  const error = (await searchParams).error;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.buildings")}
        backHref="/admin"
        backLabel={t("common.back")}
      />

      <section
        className="flex flex-col gap-3 rounded-xl p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="text-sm font-medium">{t("admin.newBuilding")}</h2>

        <form action={createBuildingAction} className="flex flex-wrap items-end gap-2">
          <Field name="name" label={t("admin.buildingName")} width={200} />
          <Field name="login" label={t("admin.login")} width={150} autoComplete="off" />
          <Field
            name="password"
            label={t("auth.password")}
            width={170}
            type="password"
            autoComplete="new-password"
            minLength={8}
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white"
            style={{ background: "var(--series-1)" }}
          >
            <Plus size={14} aria-hidden />
            {t("admin.create")}
          </button>
        </form>

        {error === "taken" ? (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {t("admin.loginTaken")}
          </p>
        ) : null}

        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {t("admin.buildingNote")}
        </p>
      </section>

      {rows.map((row) => (
        <section
          key={row.id}
          className="flex flex-col gap-3 rounded-xl p-4"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--hairline)",
            opacity: row.isActive ? 1 : 0.6,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} style={{ color: "var(--ink-muted)" }} aria-hidden />
              <div>
                <p className="text-sm font-semibold">{row.name}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {t("admin.login")}: <span className="tnum">{row.login}</span> · {row.floorCount}{" "}
                  {t("admin.floors").toLowerCase()} · {row.sensorCount}{" "}
                  {t("dashboard.sensorCount").toLowerCase()}
                </p>
              </div>
            </div>

            <form action={setBuildingActiveAction}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="active" value={row.isActive ? "0" : "1"} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
                style={{
                  border: "1px solid var(--hairline)",
                  color: row.isActive ? "var(--status-critical)" : "var(--status-good)",
                }}
              >
                <Power size={14} aria-hidden />
                {row.isActive ? t("admin.deactivate") : t("admin.activate")}
              </button>
            </form>
          </div>

          <form action={setBuildingPasswordAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={row.id} />
            <Field
              name="password"
              label={t("admin.newPassword")}
              width={190}
              type="password"
              autoComplete="new-password"
              minLength={8}
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm"
              style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
            >
              <KeyRound size={14} aria-hidden />
              {t("admin.changePassword")}
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}

function Field({
  name,
  label,
  width,
  type = "text",
  minLength,
  autoComplete,
}: {
  name: string;
  label: string;
  width: number;
  type?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </span>
      <input
        name={name}
        type={type}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        style={{
          width,
          background: "var(--surface-2)",
          border: "1px solid var(--hairline)",
          color: "var(--ink-primary)",
        }}
        className="h-9 rounded-lg px-2.5 text-sm outline-none"
      />
    </label>
  );
}
