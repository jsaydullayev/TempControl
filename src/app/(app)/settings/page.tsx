import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { LogOut, Moon, Sun } from "lucide-react";

import { LOCALE_LABELS } from "@/i18n/config";
import { THEME_COOKIE } from "@/lib/theme";
import { LOCALES, type Locale } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { logoutAction } from "@/server/auth/actions";
import { requireSession, visibleBuildings } from "@/server/auth/dal";
import { setLocaleFromSettings, setThemeAction } from "@/app/(app)/settings/actions";

/**
 * Language, theme and the session. There is no profile or password form here:
 * the account belongs to the BUILDING, and only an admin changes its password.
 */
export default async function SettingsPage() {
  const session = await requireSession();
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  const theme = (await cookies()).get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const building = visibleBuildings(session).find((b) => b.id === session.buildingId);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t("nav.settings")}
        title={t("nav.settings")}
        backHref="/"
        backLabel={t("common.back")}
      />

      <Card title={t("settings.language")}>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((code) => (
            <form key={code} action={setLocaleFromSettings}>
              <input type="hidden" name="locale" value={code} />
              <Choice active={code === locale} label={LOCALE_LABELS[code]} />
            </form>
          ))}
        </div>
      </Card>

      <Card title={t("settings.theme")}>
        <div className="flex flex-wrap gap-2">
          <form action={setThemeAction}>
            <input type="hidden" name="theme" value="dark" />
            <Choice
              active={theme === "dark"}
              label={t("settings.themeDark")}
              icon={<Moon size={14} aria-hidden />}
            />
          </form>
          <form action={setThemeAction}>
            <input type="hidden" name="theme" value="light" />
            <Choice
              active={theme === "light"}
              label={t("settings.themeLight")}
              icon={<Sun size={14} aria-hidden />}
            />
          </form>
        </div>
      </Card>

      <Card title={t("settings.session")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {session.isAdmin ? t("nav.admin") : (building?.name ?? "—")}
            </p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {session.isAdmin ? t("auth.allBuildings") : t("auth.buildingSession")}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
            >
              <LogOut size={14} aria-hidden />
              {t("auth.signOut")}
            </button>
          </form>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
          {t("settings.passwordNote")}
        </p>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Choice({
  active,
  label,
  icon,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
      style={{
        background: active ? "var(--surface-2)" : "transparent",
        border: `1px solid ${active ? "var(--series-1)" : "var(--hairline)"}`,
        color: active ? "var(--ink-primary)" : "var(--ink-secondary)",
        fontWeight: active ? 500 : 400,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
