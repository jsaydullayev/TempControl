import { getLocale, getTranslations } from "next-intl/server";
import { Cpu } from "lucide-react";
import { requestNow } from "@/lib/now";

import { formatClock, formatTemp } from "@/lib/format";
import { summariseSensor } from "@/lib/sensor-status";
import type { Entry } from "@/components/building/plan-cards";
import { PlanPanel } from "@/components/building/plan-panel";
import { RoomPanel } from "@/components/building/room-panel";
import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedLinks } from "@/components/layout/segmented-links";
import { SensorCard } from "@/components/sensors/sensor-card";
import { requireSession, visibleBuildings } from "@/server/auth/dal";
import {
  getRoomInScope,
  listDepartments,
  listFloors,
  listRooms,
  listSensorStates,
  locationsOf,
} from "@/server/dal/sensors";
import { currentBuildingId } from "@/server/dal/view-selection";

type ViewMode = "plan" | "cards";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; dept?: string; room?: string }>;
}) {
  const session = await requireSession();
  const t = await getTranslations();
  const locale = await getLocale();

  const params = await searchParams;
  const view: ViewMode = params.view === "cards" ? "cards" : "plan";

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

  const [floors, departments, states] = await Promise.all([
    listFloors(session, buildingId),
    listDepartments(session, buildingId),
    listSensorStates(session, buildingId),
  ]);

  const floorName = new Map(floors.map((f) => [f.id, f.name]));
  const byRoom = groupBy(states, (s) => s.sensor.roomId);

  // Any id that came from the client is resolved through the DAL, never trusted.
  const selectedRoom = params.room ? await getRoomInScope(session, params.room) : null;
  const openDept = params.dept
    ? (departments.find((d) => d.id === params.dept) ?? null)
    : null;

  // Drill-down: departments, then the rooms of the one that was opened.
  let entries: Entry[];
  let header: { name: string; meta: string } | undefined;
  let backHref: string | undefined;

  if (openDept) {
    const rooms = await listRooms(session, openDept.id);
    entries = rooms.map((room) => {
      const inRoom = byRoom.get(room.id) ?? [];
      return {
        id: room.id,
        name: room.name,
        meta: `${inRoom.length} ${t("dashboard.sensorCount").toLowerCase()} · ${floorName.get(openDept.floorId) ?? ""}`,
        states: inRoom,
        href: `/?dept=${openDept.id}&room=${room.id}`,
      };
    });
    const total = entries.reduce((n, e) => n + e.states.length, 0);
    header = {
      name: openDept.name,
      meta: `${entries.length} ${t("dashboard.rooms")} · ${total} ${t("dashboard.sensorCount").toLowerCase()}`,
    };
    backHref = "/";
  } else {
    entries = await Promise.all(
      departments.map(async (dept) => {
        const rooms = await listRooms(session, dept.id);
        const inDept = rooms.flatMap((r) => byRoom.get(r.id) ?? []);
        return {
          id: dept.id,
          name: dept.name,
          meta: `${rooms.length} ${t("dashboard.rooms")} · ${floorName.get(dept.floorId) ?? ""}`,
          states: inDept,
          href: `/?dept=${dept.id}`,
        };
      }),
    );
  }

  const summaries = states.map(summariseSensor);
  const attention = states.filter((_, i) => summaries[i].offline || summaries[i].severity !== "good");

  const live = states.filter((s) => s.isOnline && s.latest);
  const temps = live.map((s) => s.latest!.tempC);
  const avg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const lastSeen = states.reduce<number | null>(
    (max, s) => (s.lastSeen && (max === null || s.lastSeen > max) ? s.lastSeen : max),
    null,
  );

  const roomCount = new Set(states.map((s) => s.sensor.roomId)).size;
  const building = visibleBuildings(session).find((b) => b.id === buildingId);
  const locations = await locationsOf([
    ...states.map((s) => s.sensor.roomId),
    ...(selectedRoom ? [selectedRoom.id] : []),
  ]);
  const selectedLoc = selectedRoom ? locations.get(selectedRoom.id) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={openDept ? openDept.name : (building?.name ?? "")}
        stats={[
          {
            label: t("dashboard.avgTemp"),
            value: avg === null ? "—" : formatTemp(avg),
            unit: avg === null ? undefined : "°C",
          },
          {
            label: t("dashboard.attention"),
            value: `${attention.length}`,
            unit: `${t("dashboard.outOf")} ${states.length}`,
            accent: attention.length > 0 ? "var(--status-critical)" : undefined,
          },
          {
            label: t("dashboard.updated"),
            value: lastSeen ? formatClock(lastSeen, locale) : "—",
            dot: "var(--status-good)",
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {departments.length} {t("dashboard.departments")} · {roomCount} {t("dashboard.rooms")} ·{" "}
          {states.length} {t("dashboard.sensorCount").toLowerCase()}
        </p>

        <SegmentedLinks
          ariaLabel={t("plan.view")}
          current={view}
          items={[
            { key: "plan", label: t("plan.viewPlan"), href: "/" },
            { key: "cards", label: t("plan.viewCards"), href: "/?view=cards" },
          ]}
        />
      </div>

      {states.length === 0 ? (
        <EmptyState title={t("dashboard.emptyTitle")} body={t("dashboard.emptyBody")} />
      ) : view === "plan" ? (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          {/* The canvas must stay wide enough for a full-width card. */}
          <div className="min-w-0 flex-1 xl:min-w-[430px]">
            <PlanPanel
              entries={entries}
              // Layout is remembered per list, so rooms do not inherit a department layout.
              storageKey={
                openDept ? `tc-layout:rooms:${openDept.id}` : `tc-layout:depts:${buildingId}`
              }
              eyebrow={openDept ? t("dashboard.rooms") : t("dashboard.departments")}
              hint={openDept ? t("plan.hintRooms") : t("plan.hintDepartments")}
              // Arranging the plan is an admin job; everyone else reads it.
              editable={session.isAdmin}
              header={header}
              backHref={backHref}
            />
          </div>
          {selectedRoom ? (
            <RoomPanel
              room={selectedRoom}
              states={byRoom.get(selectedRoom.id) ?? []}
              breadcrumb={[selectedLoc?.department, selectedLoc?.floor].filter(Boolean).join(" · ")}
            />
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {states.map((state) => (
            <SensorCard
              key={state.sensor.id}
              state={state}
              roomName={locations.get(state.sensor.roomId)?.room ?? ""}
              now={requestNow()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl px-6 py-16 text-center"
      style={{ background: "var(--surface-1)", border: "1px dashed var(--axis)" }}
    >
      <Cpu size={22} style={{ color: "var(--ink-muted)" }} aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
        {body}
      </p>
    </div>
  );
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
