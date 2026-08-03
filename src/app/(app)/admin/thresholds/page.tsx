import { getTranslations } from "next-intl/server";
import { RotateCcw, Save } from "lucide-react";

import { DEFAULT_THRESHOLDS, type Metric } from "@/lib/types";
import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin, visibleBuildings } from "@/server/auth/dal";
import { structureOf, thresholdsFor } from "@/server/dal/admin";
import { DEFAULT_SUSTAIN_MINUTES } from "@/server/alerts/rules";
import { currentBuildingId } from "@/server/dal/view-selection";
import { clearThresholdAction, saveThresholdAction } from "@/app/(app)/admin/actions";

interface Rule {
  minValue: number;
  maxValue: number;
  hysteresis: number;
  sustainMinutes: number;
}

/**
 * Threshold editor: building defaults, plus a per-sensor override where one
 * room genuinely differs (a fridge does not want the office's limits).
 */
export default async function ThresholdsPage() {
  const session = await requireAdmin();
  const t = await getTranslations();

  if (visibleBuildings(session).length === 0) {
    return (
      <NoBuildings
        title={t("common.noBuildings")}
        body={t("common.noBuildingsBody")}
        action={t("common.createBuilding")}
      />
    );
  }

  const buildingId = await currentBuildingId(session);
  const building = visibleBuildings(session).find((b) => b.id === buildingId);

  const [rows, structure] = await Promise.all([
    thresholdsFor(buildingId),
    structureOf(buildingId),
  ]);

  const find = (scope: string, scopeId: string, metric: Metric) =>
    rows.find((r) => r.scope === scope && r.scopeId === scopeId && r.metric === metric);

  /**
   * What a sensor WITHOUT an override actually obeys — the building's rule, or
   * the application default when the building has none either.
   *
   * The per-sensor forms must start from this, not from the application default.
   * Otherwise a building set to 20–24 shows 18–26 beside every sensor, and an
   * admin who presses Save on one of them silently widens that sensor's limits
   * while believing they changed nothing.
   */
  const inherited = (metric: Metric) => {
    const row = find("building", buildingId, metric);
    const base = DEFAULT_THRESHOLDS[metric];
    return {
      minValue: row?.minValue ?? base.min,
      maxValue: row?.maxValue ?? base.max,
      hysteresis: row?.hysteresis ?? base.hysteresis,
      sustainMinutes: row?.sustainMinutes ?? DEFAULT_SUSTAIN_MINUTES,
    };
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={building?.name ?? ""}
        title={t("admin.thresholds")}
        backHref="/admin"
        backLabel={t("common.back")}
      />

      <section
        className="flex flex-col gap-4 rounded-xl p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <div>
          <h2 className="text-sm font-medium">{t("admin.buildingDefaults")}</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
            {t("admin.thresholdsHelp")}
          </p>
        </div>

        {(["temp", "hum"] as Metric[]).map((metric) => (
          <RuleForm
            key={metric}
            metric={metric}
            scope="building"
            scopeId={buildingId}
            row={find("building", buildingId, metric)}
            t={t}
          />
        ))}
      </section>

      <section
        className="flex flex-col gap-4 rounded-xl p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <div>
          <h2 className="text-sm font-medium">{t("admin.sensorOverrides")}</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
            {t("admin.overrideHelp")}
          </p>
        </div>

        {structure.sensors.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("common.noData")}
          </p>
        ) : (
          structure.sensors.map((sensor) => (
            <div
              key={sensor.id}
              className="flex flex-col gap-3 border-t pt-3"
              style={{ borderColor: "var(--hairline)" }}
            >
              <p className="text-sm font-medium">{sensor.name}</p>
              {(["temp", "hum"] as Metric[]).map((metric) => (
                <RuleForm
                  key={metric}
                  metric={metric}
                  scope="sensor"
                  scopeId={sensor.id}
                  row={find("sensor", sensor.id, metric)}
                  fallback={inherited(metric)}
                  t={t}
                  compact
                />
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function RuleForm({
  metric,
  scope,
  scopeId,
  row,
  fallback,
  t,
  compact,
}: {
  metric: Metric;
  scope: "building" | "sensor";
  scopeId: string;
  row?: Rule;
  /** Shown when there is no own rule — what this scope currently inherits. */
  fallback?: Rule;
  t: Awaited<ReturnType<typeof getTranslations>>;
  compact?: boolean;
}) {
  const base = fallback ?? {
    minValue: DEFAULT_THRESHOLDS[metric].min,
    maxValue: DEFAULT_THRESHOLDS[metric].max,
    hysteresis: DEFAULT_THRESHOLDS[metric].hysteresis,
    sustainMinutes: DEFAULT_SUSTAIN_MINUTES,
  };
  const unit = metric === "temp" ? "°C" : "%";
  const isSet = Boolean(row);

  return (
    <form action={saveThresholdAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="scopeId" value={scopeId} />
      <input type="hidden" name="metric" value={metric} />

      <span
        className="w-20 shrink-0 text-sm"
        style={{ color: isSet ? "var(--ink-primary)" : "var(--ink-muted)" }}
      >
        {t(metric === "temp" ? "sensors.temperature" : "sensors.humidity")}
      </span>

      <Num name="min" label={`${t("admin.min")} ${unit}`} value={row?.minValue ?? base.minValue} />
      <Num name="max" label={`${t("admin.max")} ${unit}`} value={row?.maxValue ?? base.maxValue} />
      <Num
        name="hysteresis"
        label={t("admin.hysteresis")}
        value={row?.hysteresis ?? base.hysteresis}
        step={0.1}
      />
      <Num
        name="sustainMinutes"
        label={t("admin.sustain")}
        value={row?.sustainMinutes ?? base.sustainMinutes}
        step={1}
      />

      <button
        type="submit"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white"
        style={{ background: "var(--series-1)" }}
      >
        <Save size={14} aria-hidden />
        {compact ? "" : t("admin.save")}
      </button>

      {isSet ? (
        <button
          type="submit"
          formAction={clearThresholdAction}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm"
          style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
        >
          <RotateCcw size={14} aria-hidden />
          {compact ? "" : t("admin.useDefault")}
        </button>
      ) : null}
    </form>
  );
}

function Num({
  name,
  label,
  value,
  step = 0.5,
}: {
  name: string;
  label: string;
  value: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </span>
      <input
        name={name}
        type="number"
        step={step}
        defaultValue={value}
        required
        className="tnum h-9 w-24 rounded-lg px-2.5 text-sm outline-none"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--hairline)",
          color: "var(--ink-primary)",
        }}
      />
    </label>
  );
}
