import { getTranslations } from "next-intl/server";
import { LogOut, Thermometer } from "lucide-react";

import { cookies } from "next/headers";

import { THEME_COOKIE, type Theme } from "@/lib/theme";
import type { Building } from "@/lib/types";
import { logoutAction } from "@/server/auth/actions";
import { AlertBell, type AlertItem } from "@/components/alerts/alert-bell";
import { BuildingSwitcher } from "@/components/layout/building-switcher";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface Props {
  buildings: Building[];
  currentBuildingId: string;
  isAdmin: boolean;
  alerts: AlertItem[];
  unseen: number;
}

export async function Topbar({
  buildings,
  currentBuildingId,
  isAdmin,
  alerts,
  unseen,
}: Props) {
  const t = await getTranslations();
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = stored === "light" ? "light" : "dark";

  return (
    <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
      {/* The sidebar carries the brand on desktop; on mobile it lives here. */}
      <span className="flex items-center gap-2 lg:hidden">
        <Thermometer size={18} style={{ color: "var(--series-1)" }} aria-hidden />
      </span>

      <BuildingSwitcher
        buildings={buildings}
        currentId={currentBuildingId}
        label={t("nav.building")}
      />

      {isAdmin ? (
        /* Hidden on a phone: the tab bar already carries an Administrator entry,
           and this badge was the item that pushed the row past 360px. */
        <span
          className="hidden rounded-md px-2 py-0.5 text-xs font-medium sm:inline-block"
          style={{
            background: "color-mix(in srgb, var(--series-7) 16%, transparent)",
            color: "var(--series-7)",
          }}
        >
          {t("nav.admin")}
        </span>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Mobile reaches alerts through the tab bar, so the bell would be a
            duplicate — and the topbar has no room for it on a phone. */}
        <span className="hidden lg:block">
          <AlertBell
            items={alerts}
            unseen={unseen}
            label={t("nav.alerts")}
            allLabel={t("dashboard.allAlerts")}
            emptyLabel={t("dashboard.allNormal")}
          />
        </span>
        <LocaleSwitcher />
        <ThemeToggle label={t("settings.theme")} theme={theme} />
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label={t("auth.signOut")}
            title={t("auth.signOut")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
          >
            <LogOut size={16} aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
