import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requestNow } from "@/lib/now";

import { formatHumidity, formatTemp, relativeTimeParts } from "@/lib/format";
import { summariseSensor } from "@/lib/sensor-status";
import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { requireSession, visibleBuildings } from "@/server/auth/dal";
import { getRoomInScope, listSensorStates, locationsOf } from "@/server/dal/sensors";
import { currentBuildingId, currentFloorId } from "@/server/dal/view-selection";

const STATUS_COLOR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  offline: "var(--ink-muted)",
  lowBattery: "var(--status-warning)",
};

export default async function SensorsPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const session = await requireSession();
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
  const floorId = await currentFloorId(buildingId);
  const all = await listSensorStates(session, buildingId, floorId ? { floorId } : {});

  // Any id from the client is validated before it is used or displayed.
  const roomId = (await searchParams).room;
  const room = roomId ? await getRoomInScope(session, roomId) : null;
  const states = room ? all.filter((s) => s.sensor.roomId === room.id) : all;

  const building = visibleBuildings(session).find((b) => b.id === buildingId);
  const locations = await locationsOf(states.map((s) => s.sensor.roomId));
  const now = requestNow();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={building?.name ?? ""}
        title={t("nav.sensors")}
        backHref="/"
        backLabel={t("common.back")}
      />

      {room ? (
        <div className="flex items-center gap-3 text-sm">
          <span style={{ color: "var(--ink-muted)" }}>{room.name}</span>
          <Link href="/sensors" style={{ color: "var(--series-1)" }}>
            {t("common.all")}
          </Link>
        </div>
      ) : null}

      {/* The table scrolls inside its own box so the page never scrolls sideways. */}
      <div
        className="overflow-x-auto rounded-xl"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr style={{ color: "var(--ink-muted)" }}>
              <Th>{t("sensors.name")}</Th>
              <Th>{t("sensors.room")}</Th>
              <Th align="right">{t("sensors.temperature")}</Th>
              <Th align="right">{t("sensors.humidity")}</Th>
              <Th align="right">{t("sensors.battery")}</Th>
              <Th align="right">{t("sensors.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {states.map((state) => {
              const summary = summariseSensor(state);
              const rel = relativeTimeParts(state.lastSeen, now);
              const loc = locations.get(state.sensor.roomId) ?? {
                room: "",
                department: "",
                floor: "",
              };

              return (
                <tr key={state.sensor.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <Td>
                    <Link
                      href={`/sensors/${state.sensor.id}`}
                      className="font-medium hover:underline"
                    >
                      {state.sensor.name}
                    </Link>
                  </Td>
                  <Td muted title={`${loc.floor} · ${loc.department}`}>
                    {loc.room}
                  </Td>
                  <Td align="right" numeric>
                    {state.latest ? `${formatTemp(state.latest.tempC)} °C` : "— —"}
                  </Td>
                  <Td align="right" numeric>
                    {state.latest ? `${formatHumidity(state.latest.humidity)} %` : "— —"}
                  </Td>
                  <Td align="right" numeric>
                    {state.latest ? `${state.latest.battery} %` : "—"}
                  </Td>
                  <Td align="right">
                    {/* Status as coloured text, but the word is what carries it. */}
                    <span style={{ color: STATUS_COLOR[summary.kind] }}>
                      {t(`status.${summary.labelKey}`)}
                    </span>
                    <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                      {rel ? t(`time.${rel.key}`, { count: rel.count }) : t("sensors.never")}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-xs font-medium"
      style={{ textAlign: align ?? "left" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
  numeric,
  title,
}: {
  children: React.ReactNode;
  align?: "right";
  muted?: boolean;
  numeric?: boolean;
  title?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${numeric ? "tnum" : ""}`}
      title={title}
      style={{
        textAlign: align ?? "left",
        color: muted ? "var(--ink-muted)" : "var(--ink-primary)",
      }}
    >
      {children}
    </td>
  );
}
