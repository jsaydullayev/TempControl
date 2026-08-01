import { getTranslations } from "next-intl/server";

import { NoBuildings } from "@/components/layout/no-buildings";
import { PageHeader } from "@/components/layout/page-header";
import { StructureCanvas, type StructureItem } from "@/components/admin/structure-canvas";
import { requireAdmin, visibleBuildings } from "@/server/auth/dal";
import { structureOf } from "@/server/dal/admin";
import { currentBuildingId } from "@/server/dal/view-selection";
import {
  addDepartmentAction,
  addFloorAction,
  addRoomAction,
  deactivateAction,
  renameAction,
} from "@/app/(app)/admin/actions";

/**
 * The building constructor, drilling Floor → Department → Room in the same
 * card canvas the dashboard uses. Nothing about a building is hardcoded in the
 * app: this page is where its structure comes from.
 */
export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{ floor?: string; dept?: string }>;
}) {
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
  const { floors, departments, rooms, sensors } = await structureOf(buildingId);

  const params = await searchParams;
  const openFloor = params.floor ? floors.find((f) => f.id === params.floor) : undefined;
  const openDept =
    openFloor && params.dept
      ? departments.find((d) => d.id === params.dept && d.floorId === openFloor.id)
      : undefined;

  const sensorsInRoom = new Map<string, number>();
  for (const s of sensors) {
    if (!s.roomId) continue;
    sensorsInRoom.set(s.roomId, (sensorsInRoom.get(s.roomId) ?? 0) + 1);
  }

  const roomsOf = (deptId: string) => rooms.filter((r) => r.departmentId === deptId);
  const deptsOf = (floorId: string) => departments.filter((d) => d.floorId === floorId);

  const sensorWord = t("dashboard.sensorCount").toLowerCase();

  // Room level ────────────────────────────────────────────────────────────
  if (openDept && openFloor) {
    const items: StructureItem[] = roomsOf(openDept.id).map((room) => ({
      id: room.id,
      name: room.name,
      meta: `${sensorsInRoom.get(room.id) ?? 0} ${sensorWord}`,
      href: `/admin/structure?floor=${openFloor.id}&dept=${openDept.id}`,
      entity: "room",
    }));

    return (
      <Page
        title={t("admin.structure")}
        eyebrow={building?.name ?? ""}
        backLabel={t("common.back")}
      >
        <StructureCanvas
          items={items}
          storageKey={`tc-layout:admin-rooms:${openDept.id}`}
          eyebrow={t("dashboard.rooms")}
          hint={t("admin.hintRooms")}
          emptyHint={t("admin.noRooms")}
          add={{
            action: addRoomAction,
            hidden: { departmentId: openDept.id },
            placeholder: t("admin.newRoom"),
          }}
          remove={{ action: deactivateAction, label: t("admin.remove") }}
          rename={{ action: renameAction, label: t("admin.rename") }}
          labels={{
            edit: t("admin.edit"),
            cancel: t("admin.cancel"),
            confirmDelete: t("admin.confirmDelete"),
            confirmYes: t("admin.confirmYes"),
          }}
          header={{
            name: openDept.name,
            meta: `${openFloor.name} · ${items.length} ${t("dashboard.rooms")}`,
          }}
          backHref={`/admin/structure?floor=${openFloor.id}`}
        />
      </Page>
    );
  }

  // Department level ──────────────────────────────────────────────────────
  if (openFloor) {
    const items: StructureItem[] = deptsOf(openFloor.id).map((dept) => {
      const deptRooms = roomsOf(dept.id);
      const count = deptRooms.reduce((n, r) => n + (sensorsInRoom.get(r.id) ?? 0), 0);
      return {
        id: dept.id,
        name: dept.name,
        meta: `${deptRooms.length} ${t("dashboard.rooms")} · ${count} ${sensorWord}`,
        href: `/admin/structure?floor=${openFloor.id}&dept=${dept.id}`,
        entity: "department",
      };
    });

    return (
      <Page
        title={t("admin.structure")}
        eyebrow={building?.name ?? ""}
        backLabel={t("common.back")}
      >
        <StructureCanvas
          items={items}
          storageKey={`tc-layout:admin-depts:${openFloor.id}`}
          eyebrow={t("dashboard.departments")}
          hint={t("admin.hintDepartments")}
          emptyHint={t("admin.noDepartments")}
          add={{
            action: addDepartmentAction,
            hidden: { buildingId, floorId: openFloor.id },
            placeholder: t("admin.newDepartment"),
          }}
          remove={{ action: deactivateAction, label: t("admin.remove") }}
          rename={{ action: renameAction, label: t("admin.rename") }}
          labels={{
            edit: t("admin.edit"),
            cancel: t("admin.cancel"),
            confirmDelete: t("admin.confirmDelete"),
            confirmYes: t("admin.confirmYes"),
          }}
          header={{
            name: openFloor.name,
            meta: `${items.length} ${t("dashboard.departments")}`,
          }}
          backHref="/admin/structure"
        />
      </Page>
    );
  }

  // Floor level ───────────────────────────────────────────────────────────
  const items: StructureItem[] = floors.map((floor) => {
    const floorDepts = deptsOf(floor.id);
    const floorRooms = floorDepts.flatMap((d) => roomsOf(d.id));
    return {
      id: floor.id,
      name: floor.name,
      meta: `${floorDepts.length} ${t("dashboard.departments")} · ${floorRooms.length} ${t("dashboard.rooms")}`,
      href: `/admin/structure?floor=${floor.id}`,
      entity: "floor",
    };
  });

  return (
    <Page
        title={t("admin.structure")}
        eyebrow={building?.name ?? ""}
        backLabel={t("common.back")}
      >
      <StructureCanvas
        items={items}
        storageKey={`tc-layout:admin-floors:${buildingId}`}
        eyebrow={t("admin.floors")}
        hint={t("admin.hintFloors")}
        emptyHint={t("admin.noFloors")}
        add={{
          action: addFloorAction,
          hidden: { buildingId },
          placeholder: t("admin.newFloor"),
        }}
        remove={{ action: deactivateAction, label: t("admin.remove") }}
        rename={{ action: renameAction, label: t("admin.rename") }}
        labels={{
          edit: t("admin.edit"),
          cancel: t("admin.cancel"),
          confirmDelete: t("admin.confirmDelete"),
          confirmYes: t("admin.confirmYes"),
        }}
      />
    </Page>
  );
}

function Page({
  title,
  eyebrow,
  backLabel,
  children,
}: {
  title: string;
  eyebrow: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        backHref="/admin"
        backLabel={backLabel}
      />
      {children}
    </div>
  );
}
