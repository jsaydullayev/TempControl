import { getTranslations } from "next-intl/server";
import { Link2, Unlink } from "lucide-react";

import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin, visibleBuildings } from "@/server/auth/dal";
import { listDevices, roomsForBuilding, sensorsInRooms, type DeviceRow } from "@/server/dal/admin";
import { currentBuildingId } from "@/server/dal/view-selection";
import { bindDeviceAction, unbindSensorAction, updateSensorAction } from "@/app/(app)/admin/actions";

/**
 * Device wiring: the provider reports what exists, the admin says where it is.
 * A bound sensor takes its ROOM's name automatically.
 */
export default async function AdminSensorsPage() {
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

  // A provider outage must not blank the page: the bound sensors below live in
  // our own database and stay editable even when Tuya is unreachable.
  let devices: DeviceRow[] = [];
  let providerFailed = false;
  const roomListPromise = roomsForBuilding(buildingId);
  try {
    devices = await listDevices();
  } catch {
    providerFailed = true;
  }

  const roomList = await roomListPromise;
  const bound = await sensorsInRooms(roomList.map((r) => r.id));

  const roomLabel = new Map(
    roomList.map((r) => [r.id, `${r.floorName} · ${r.departmentName} · ${r.name}`]),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={building?.name ?? ""}
        title={t("admin.sensors")}
        backHref="/admin"
        backLabel={t("common.back")}
      />

      <section
        className="flex flex-col gap-3 rounded-xl p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="text-sm font-medium">{t("admin.devices")}</h2>

        {providerFailed ? (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {t("admin.providerFailed")}
          </p>
        ) : roomList.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("admin.needRooms")}
          </p>
        ) : devices.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("admin.noDevices")}
          </p>
        ) : (
          devices.map((device) => {
            const elsewhere = device.boundTo !== null && device.boundTo.buildingId !== buildingId;
            const here = device.boundTo !== null && device.boundTo.buildingId === buildingId;
            return (
            <form
              key={device.externalId}
              action={bindDeviceAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="externalId" value={device.externalId} />
              <span className="tnum min-w-[7rem] text-sm font-medium">{device.externalId}</span>
              <span
                className="text-xs"
                style={{ color: device.online ? "var(--status-good)" : "var(--ink-muted)" }}
              >
                {device.online ? t("status.good") : t("status.offline")}
              </span>

              {/* Where it is now — the fact that made this device unreachable
                  when the list showed only unbound ones. */}
              <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                {device.boundTo
                  ? `${device.boundTo.buildingName} · ${device.boundTo.label}`
                  : t("admin.deviceFree")}
              </span>

              {here ? (
                <span className="text-xs" style={{ color: "var(--status-good)" }}>
                  {t("admin.bound")}
                </span>
              ) : (
                <>
              <select
                name="roomId"
                required
                defaultValue=""
                className="min-w-0 basis-56 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  color: "var(--ink-primary)",
                }}
              >
                <option value="" disabled style={{ background: "var(--surface-1)", color: "var(--ink-primary)" }}>
                  {t("admin.pickRoom")}
                </option>
                {roomList.map((room) => (
                  <option key={room.id} value={room.id} style={{ background: "var(--surface-1)", color: "var(--ink-primary)" }}>
                    {roomLabel.get(room.id)}
                  </option>
                ))}
              </select>
              {/* Optional: blank falls back to the room name, which is the
                  right answer for one sensor per room and wrong the moment a
                  room holds two. */}
              <input
                name="name"
                maxLength={120}
                placeholder={t("admin.nameOptional")}
                className="min-w-0 basis-44 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  color: "var(--ink-primary)",
                }}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ background: "var(--series-1)" }}
              >
                <Link2 size={14} aria-hidden />
                {elsewhere ? t("admin.moveHere") : t("admin.bind")}
              </button>
                </>
              )}
            </form>
            );
          })
        )}

        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {t("admin.nameFromRoom")}
        </p>
      </section>

      <section
        className="flex flex-col gap-2 rounded-xl p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="mb-1 text-sm font-medium">{t("admin.bound")}</h2>

        {bound.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {t("common.noData")}
          </p>
        ) : (
          bound.map((sensor) => (
            <div
              key={sensor.id}
              className="flex flex-col gap-2 border-t pt-3"
              style={{ borderColor: "var(--hairline)" }}
            >
              <p className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                {sensor.roomId ? roomLabel.get(sensor.roomId) : "—"} · {sensor.externalId}
              </p>

              <div className="flex flex-wrap items-end gap-2">
                {/* Name and calibration in one row: an offset is only ever set
                    while looking at the sensor it belongs to. */}
                <form action={updateSensorAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={sensor.id} />
                  <Field name="name" label={t("sensors.name")} defaultValue={sensor.name} width={190} />
                  <Field
                    name="tempOffset"
                    label={`${t("admin.offset")} °C`}
                    defaultValue={String(sensor.tempOffset ?? 0)}
                    width={96}
                    numeric
                  />
                  <Field
                    name="humOffset"
                    label={`${t("admin.offset")} %`}
                    defaultValue={String(sensor.humOffset ?? 0)}
                    width={96}
                    numeric
                  />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm"
                    style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
                  >
                    {t("admin.save")}
                  </button>
                </form>

                <form action={unbindSensorAction}>
                  <input type="hidden" name="id" value={sensor.id} />
                  <button
                    type="submit"
                    aria-label={t("admin.unbind")}
                    title={t("admin.unbind")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
                  >
                    <Unlink size={14} aria-hidden />
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  width,
  numeric,
}: {
  name: string;
  label: string;
  defaultValue: string;
  width: number;
  numeric?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        type={numeric ? "number" : "text"}
        step={numeric ? 0.1 : undefined}
        required
        className={`h-9 rounded-lg px-2.5 text-sm outline-none ${numeric ? "tnum" : ""}`}
        style={{
          width,
          background: "var(--surface-2)",
          border: "1px solid var(--hairline)",
          color: "var(--ink-primary)",
        }}
      />
    </label>
  );
}
