import { getTranslations } from "next-intl/server";
import { CheckCircle2, OctagonAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/server/auth/dal";
import { tuyaConfigFromEnv } from "@/server/providers/tuya/client";
import { testTuyaConnection } from "@/server/providers/tuya";

/**
 * Tuya connection status and a live check.
 *
 * Credentials come from the environment, never from the database: an Access
 * Secret in a table is one SQL injection away from being someone else's.
 */
export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations();

  const config = tuyaConfigFromEnv();
  const provider = process.env.PROVIDER ?? "mock";
  const shouldTest = (await searchParams).test === "1" && config !== null;
  const result = shouldTest ? await testTuyaConnection(config!) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t("nav.admin")}
        title="Tuya"
        backHref="/admin"
        backLabel={t("common.back")}
      />

      <section
        className="flex flex-col gap-3 rounded-xl p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <Field label={t("tuya.mode")} value={provider === "tuya" ? "Tuya" : t("tuya.mock")} />
        <Field
          label={t("tuya.accessId")}
          value={config ? `${config.clientId.slice(0, 6)}…` : t("tuya.notSet")}
        />
        <Field label={t("tuya.region")} value={config?.baseUrl ?? t("tuya.notSet")} />

        {config ? (
          <form className="mt-1">
            <input type="hidden" name="test" value="1" />
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ background: "var(--series-1)" }}
            >
              {t("tuya.test")}
            </button>
          </form>
        ) : null}

        {result ? (
          <div
            className="mt-1 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
            style={{
              background: `color-mix(in srgb, var(--status-${result.ok ? "good" : "critical"}) 12%, transparent)`,
            }}
          >
            {result.ok ? (
              <CheckCircle2 size={16} style={{ color: "var(--status-good)" }} aria-hidden />
            ) : (
              <OctagonAlert size={16} style={{ color: "var(--status-critical)" }} aria-hidden />
            )}
            <div>
              {result.ok ? (
                <p>{t("tuya.okDevices", { count: result.deviceCount })}</p>
              ) : (
                <>
                  <p className="font-medium">
                    {t("tuya.failed")} — {result.code}
                  </p>
                  <p style={{ color: "var(--ink-secondary)" }}>{result.message}</p>
                  {result.hint ? (
                    <p className="mt-1" style={{ color: "var(--ink-secondary)" }}>
                      {result.hint}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section
        className="flex flex-col gap-2 rounded-xl p-4 text-sm"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="text-sm font-medium">{t("tuya.setupTitle")}</h2>
        <ol
          className="ml-4 flex list-decimal flex-col gap-1.5"
          style={{ color: "var(--ink-secondary)" }}
        >
          <li>{t("tuya.step1")}</li>
          <li>{t("tuya.step2")}</li>
          <li>{t("tuya.step3")}</li>
          <li>{t("tuya.step4")}</li>
        </ol>
        <pre
          className="mt-2 overflow-x-auto rounded-lg p-3 text-xs"
          style={{ background: "var(--surface-2)", color: "var(--ink-secondary)" }}
        >{`PROVIDER=tuya
TUYA_ACCESS_ID=...
TUYA_ACCESS_SECRET=...
TUYA_BASE_URL=https://openapi.tuyaeu.com
POLL_INTERVAL_SEC=300`}</pre>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: "var(--ink-secondary)" }}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
