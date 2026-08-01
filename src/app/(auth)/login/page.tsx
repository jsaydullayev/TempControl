import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Thermometer } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { getSession } from "@/server/auth/dal";

export default async function LoginPage() {
  // Checked here, not in the proxy: only this layer can tell a live session
  // from a stale cookie, so only here is it safe to redirect away.
  if (await getSession()) redirect("/");

  const t = await getTranslations();

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — a calm temperature gradient, no imagery to load. */}
      <section
        className="relative hidden flex-col justify-between p-10 lg:flex"
        style={{
          background:
            "linear-gradient(155deg, color-mix(in srgb, var(--temp-cold) 88%, black) 0%, color-mix(in srgb, var(--temp-cold) 55%, var(--plane)) 55%, color-mix(in srgb, var(--status-serious) 45%, var(--plane)) 100%)",
        }}
      >
        <div className="flex items-center gap-2.5 text-white">
          <Thermometer size={22} aria-hidden />
          <span className="text-lg font-semibold tracking-tight">{t("common.appName")}</span>
        </div>

        <div className="max-w-md">
          <p className="text-3xl leading-tight font-semibold text-white">
            {t("common.tagline")}
          </p>
          <p className="mt-3 text-sm text-white/80">{t("auth.buildingNote")}</p>
        </div>

        <p className="text-xs text-white/60">© {new Date().getFullYear()} TempControl</p>
      </section>

      {/* Form panel */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:hidden">
              <Thermometer size={20} style={{ color: "var(--series-1)" }} aria-hidden />
              <span className="font-semibold">{t("common.appName")}</span>
            </div>
            <div className="ml-auto">
              <LocaleSwitcher />
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signInTitle")}</h1>
          <p className="mt-1.5 mb-8 text-sm" style={{ color: "var(--ink-secondary)" }}>
            {t("auth.signInSubtitle")}
          </p>

          <LoginForm />

        </div>
      </section>
    </main>
  );
}

