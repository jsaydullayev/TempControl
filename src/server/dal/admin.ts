import "server-only";

import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { alerts, auditLog, buildings, departments, floors, rooms, sensors, thresholds } from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import { requireAdmin, type Session } from "@/server/auth/dal";
import { getProvider } from "@/server/providers";

/**
 * Admin-only structure editing.
 *
 * Every function re-authorises itself: these are reached from server actions,
 * which are public endpoints — being called from an admin page proves nothing.
 */

async function record(
  session: Session,
  action: string,
  entity: string,
  entityId: string | null,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({
    actorKind: session.kind,
    actorId: session.buildingId,
    action,
    entity,
    entityId,
    meta: meta ?? null,
  });
}

export async function createFloor(buildingId: string, name: string) {
  const session = await requireAdmin();

  const [max] = await db
    .select({ level: sql<number>`coalesce(max(${floors.level}), 0)` })
    .from(floors)
    .where(eq(floors.buildingId, buildingId));

  const [floor] = await db
    .insert(floors)
    .values({ buildingId, name, level: (max?.level ?? 0) + 1 })
    .returning();

  await record(session, "create", "floor", floor.id, { name });
  return floor;
}

export async function createDepartment(buildingId: string, floorId: string, name: string) {
  const session = await requireAdmin();

  // The floor must belong to the building the caller named.
  const [floor] = await db
    .select({ buildingId: floors.buildingId })
    .from(floors)
    .where(eq(floors.id, floorId))
    .limit(1);
  if (!floor || floor.buildingId !== buildingId) return null;

  const [dept] = await db
    .insert(departments)
    .values({ buildingId, floorId, name })
    .returning();

  await record(session, "create", "department", dept.id, { name, floorId });
  return dept;
}

export async function createRoom(departmentId: string, name: string) {
  const session = await requireAdmin();

  const [room] = await db.insert(rooms).values({ departmentId, name }).returning();
  await record(session, "create", "room", room.id, { name, departmentId });
  return room;
}

/** Soft delete: history and audit entries must survive the structure changing. */
export async function deactivate(entity: "floor" | "department" | "room", id: string) {
  const session = await requireAdmin();

  if (entity === "floor") {
    await db.update(floors).set({ isActive: false }).where(eq(floors.id, id));
    await db.update(departments).set({ isActive: false }).where(eq(departments.floorId, id));
  } else if (entity === "department") {
    await db.update(departments).set({ isActive: false }).where(eq(departments.id, id));
    await db.update(rooms).set({ isActive: false }).where(eq(rooms.departmentId, id));
  } else {
    await db.update(rooms).set({ isActive: false }).where(eq(rooms.id, id));
    // Sensors are released rather than deleted — the readings stay attached.
    await db.update(sensors).set({ roomId: null }).where(eq(sensors.roomId, id));
  }

  await record(session, "deactivate", entity, id);
}

export async function rename(entity: "floor" | "department" | "room", id: string, name: string) {
  const session = await requireAdmin();

  if (entity === "floor") await db.update(floors).set({ name }).where(eq(floors.id, id));
  else if (entity === "department")
    await db.update(departments).set({ name }).where(eq(departments.id, id));
  else await db.update(rooms).set({ name }).where(eq(rooms.id, id));

  await record(session, "rename", entity, id, { name });
}

/** The whole structure of one building, for the admin editor. */
export async function structureOf(buildingId: string) {
  await requireAdmin();

  const [floorRows, deptRows, roomRows, sensorRows] = await Promise.all([
    db
      .select()
      .from(floors)
      .where(and(eq(floors.buildingId, buildingId), eq(floors.isActive, true)))
      .orderBy(asc(floors.level)),
    db
      .select()
      .from(departments)
      .where(and(eq(departments.buildingId, buildingId), eq(departments.isActive, true)))
      .orderBy(asc(departments.sortOrder), asc(departments.name)),
    db
      .select({
        id: rooms.id,
        departmentId: rooms.departmentId,
        name: rooms.name,
        buildingId: departments.buildingId,
      })
      .from(rooms)
      .innerJoin(departments, eq(departments.id, rooms.departmentId))
      .where(and(eq(departments.buildingId, buildingId), eq(rooms.isActive, true)))
      .orderBy(asc(rooms.sortOrder), asc(rooms.name)),
    db
      .select({ id: sensors.id, roomId: sensors.roomId, name: sensors.name })
      .from(sensors)
      .where(and(eq(sensors.buildingId, buildingId), eq(sensors.isActive, true))),
  ]);

  return { floors: floorRows, departments: deptRows, rooms: roomRows, sensors: sensorRows };
}

/**
 * Devices the provider reports that are not yet registered anywhere.
 * This is the list the admin picks from when wiring Tuya devices to rooms.
 */
export interface DeviceRow {
  externalId: string;
  online: boolean;
  /** Where it is bound right now, or null when it is free. */
  boundTo: { buildingId: string; buildingName: string; label: string } | null;
}

/**
 * EVERY device the provider reports, each with where it is currently bound.
 *
 * Listing only the unbound ones looks tidy and is a trap: a device bound to
 * another building vanishes from this page, which then says "all bound" and
 * offers nothing to click. The admin cannot see where the device went, and has
 * no way to move it back. So bound devices stay listed, with their location.
 */
export async function listDevices(): Promise<DeviceRow[]> {
  await requireAdmin();

  const devices = await getProvider().listDevices();

  // Only ACTIVE sensors occupy a device. An unbound one keeps its row (and its
  // readings) but must return to this list, otherwise unbinding is a one-way
  // door and the device disappears for good.
  const bound = await db
    .select({
      externalId: sensors.externalId,
      buildingId: buildings.id,
      buildingName: buildings.name,
      room: rooms.name,
      department: departments.name,
      floor: floors.name,
    })
    .from(sensors)
    .innerJoin(buildings, eq(buildings.id, sensors.buildingId))
    .leftJoin(rooms, eq(rooms.id, sensors.roomId))
    .leftJoin(departments, eq(departments.id, rooms.departmentId))
    .leftJoin(floors, eq(floors.id, departments.floorId))
    .where(eq(sensors.isActive, true));

  const byExternal = new Map(bound.map((b) => [b.externalId, b]));

  return devices.map((d) => {
    const b = byExternal.get(d.externalId);
    return {
      externalId: d.externalId,
      online: d.online,
      boundTo: b
        ? {
            buildingId: b.buildingId,
            buildingName: b.buildingName,
            label: [b.floor, b.department, b.room].filter(Boolean).join(" · "),
          }
        : null,
    };
  });
}

/**
 * Bind a device to a room.
 *
 * The name is the admin's if they typed one, otherwise the ROOM's name. A room
 * can hold several sensors, so a bare room name would collide and a numeric
 * suffix is appended — the lowest free one, not `count + 1`: after unbinding
 * the middle of three, `count + 1` hands out a name that is already taken.
 */
export async function bindDeviceToRoom(externalId: string, roomId: string, wanted?: string) {
  const session = await requireAdmin();

  const [room] = await db
    .select({ id: rooms.id, name: rooms.name, buildingId: departments.buildingId })
    .from(rooms)
    .innerJoin(departments, eq(departments.id, rooms.departmentId))
    .where(eq(rooms.id, roomId))
    .limit(1);
  if (!room) return null;

  const siblings = await db
    .select({ name: sensors.name })
    .from(sensors)
    .where(
      and(
        eq(sensors.roomId, roomId),
        eq(sensors.isActive, true),
        ne(sensors.externalId, externalId),
      ),
    );

  const name = (wanted ?? "").trim() || freeName(room.name, siblings.map((s) => s.name));

  // A device that was bound before still has its row and its whole reading
  // history — reactivate that instead of inserting a duplicate. `external_id`
  // is unique, so an insert would fail anyway.
  const [previous] = await db
    .select({ id: sensors.id })
    .from(sensors)
    .where(eq(sensors.externalId, externalId))
    .limit(1);

  const values = {
    buildingId: room.buildingId,
    roomId: room.id,
    name,
    provider: getProvider().name,
    isActive: true,
  };

  const [sensor] = previous
    ? await db.update(sensors).set(values).where(eq(sensors.id, previous.id)).returning()
    : await db
        .insert(sensors)
        .values({ ...values, externalId })
        .returning();

  await record(session, previous ? "rebind" : "bind", "sensor", sensor.id, {
    externalId,
    roomId,
    name,
  });
  return sensor;
}

/** Release a sensor from its room; the device becomes bindable again. */
export async function unbindSensor(sensorId: string) {
  const session = await requireAdmin();
  await db.update(sensors).set({ isActive: false, roomId: null }).where(eq(sensors.id, sensorId));
  await record(session, "unbind", "sensor", sensorId);
}

export async function renameSensor(sensorId: string, name: string) {
  const session = await requireAdmin();
  await db.update(sensors).set({ name }).where(eq(sensors.id, sensorId));
  await record(session, "rename", "sensor", sensorId, { name });
}

/** `base`, or `base 2`, `base 3`… — the first one nothing else in the room uses. */
function freeName(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Room ids grouped by department, used to render the picker. */
export async function roomsForBuilding(buildingId: string) {
  await requireAdmin();
  return db
    .select({
      id: rooms.id,
      name: rooms.name,
      departmentName: departments.name,
      floorName: floors.name,
    })
    .from(rooms)
    .innerJoin(departments, eq(departments.id, rooms.departmentId))
    .innerJoin(floors, eq(floors.id, departments.floorId))
    .where(and(eq(departments.buildingId, buildingId), eq(rooms.isActive, true)))
    .orderBy(asc(floors.level), asc(departments.name), asc(rooms.name));
}

export async function sensorsInRooms(roomIds: string[]) {
  await requireAdmin();
  if (roomIds.length === 0) return [];
  return db
    .select({
      id: sensors.id,
      roomId: sensors.roomId,
      name: sensors.name,
      externalId: sensors.externalId,
    })
    .from(sensors)
    .where(and(inArray(sensors.roomId, roomIds), eq(sensors.isActive, true)))
    .orderBy(asc(sensors.name));
}

/** Threshold rows for a building: its own defaults plus any per-sensor overrides. */
export async function thresholdsFor(buildingId: string) {
  await requireAdmin();

  const sensorIds = (
    await db
      .select({ id: sensors.id })
      .from(sensors)
      .where(and(eq(sensors.buildingId, buildingId), eq(sensors.isActive, true)))
  ).map((s) => s.id);

  const rows = await db
    .select()
    .from(thresholds)
    .where(
      and(
        eq(thresholds.isActive, true),
        or(
          and(eq(thresholds.scope, "building"), eq(thresholds.scopeId, buildingId)),
          sensorIds.length > 0
            ? and(eq(thresholds.scope, "sensor"), inArray(thresholds.scopeId, sensorIds))
            : undefined,
        ),
      ),
    );

  return rows;
}

/**
 * Upsert a threshold rule. The unique index on (scope, scope_id, metric) is what
 * makes this one row rather than a growing pile of overlapping rules.
 */
export async function saveThreshold(input: {
  scope: "building" | "sensor";
  scopeId: string;
  metric: "temp" | "hum";
  min: number;
  max: number;
  hysteresis: number;
  sustainMinutes: number;
}) {
  const session = await requireAdmin();
  if (input.min >= input.max) return null;

  const [row] = await db
    .insert(thresholds)
    .values({
      scope: input.scope,
      scopeId: input.scopeId,
      metric: input.metric,
      minValue: input.min,
      maxValue: input.max,
      hysteresis: input.hysteresis,
      sustainMinutes: input.sustainMinutes,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [thresholds.scope, thresholds.scopeId, thresholds.metric],
      set: {
        minValue: input.min,
        maxValue: input.max,
        hysteresis: input.hysteresis,
        sustainMinutes: input.sustainMinutes,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  await record(session, "save", "threshold", row.id, { ...input });
  return row;
}

/** Drops an override so the level above it applies again. */
export async function clearThreshold(scope: "building" | "sensor", scopeId: string, metric: string) {
  const session = await requireAdmin();
  await db
    .delete(thresholds)
    .where(
      and(
        eq(thresholds.scope, scope),
        eq(thresholds.scopeId, scopeId),
        eq(thresholds.metric, metric),
      ),
    );
  await record(session, "clear", "threshold", scopeId, { scope, metric });
}

/** Every building with its login and a live count, for the admin list. */
export async function listBuildingsAdmin() {
  await requireAdmin();

  const [buildingRows, sensorRows, floorRows] = await Promise.all([
    db
      .select({
        id: buildings.id,
        name: buildings.name,
        slug: buildings.slug,
        login: buildings.login,
        isActive: buildings.isActive,
      })
      .from(buildings)
      .orderBy(asc(buildings.name)),
    db
      .select({ buildingId: sensors.buildingId, n: sql<number>`count(*)` })
      .from(sensors)
      .where(eq(sensors.isActive, true))
      .groupBy(sensors.buildingId),
    db
      .select({ buildingId: floors.buildingId, n: sql<number>`count(*)` })
      .from(floors)
      .where(eq(floors.isActive, true))
      .groupBy(floors.buildingId),
  ]);

  const sensorCounts = new Map(sensorRows.map((r) => [r.buildingId, Number(r.n)]));
  const floorCounts = new Map(floorRows.map((r) => [r.buildingId, Number(r.n)]));

  return buildingRows.map((b) => ({
    ...b,
    sensorCount: sensorCounts.get(b.id) ?? 0,
    floorCount: floorCounts.get(b.id) ?? 0,
  }));
}

/** Login and slug are lowercased so a capital letter cannot create a twin. */
function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}

export async function createBuilding(input: {
  name: string;
  login: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; reason: "taken" }> {
  const session = await requireAdmin();

  const login = normaliseKey(input.login);
  const slug = normaliseKey(input.name).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || login;

  // A duplicate login would make one of the two buildings unreachable.
  const [clash] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(or(eq(buildings.login, login), eq(buildings.slug, slug)))
    .limit(1);
  if (clash) return { ok: false, reason: "taken" };

  const [building] = await db
    .insert(buildings)
    .values({
      name: input.name.trim(),
      slug,
      login,
      passwordHash: await hashPassword(input.password),
    })
    .returning();

  await record(session, "create", "building", building.id, { name: input.name, login });
  return { ok: true };
}

export async function setBuildingPassword(buildingId: string, password: string) {
  const session = await requireAdmin();

  await db
    .update(buildings)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(buildings.id, buildingId));

  // The password itself never reaches the audit log.
  await record(session, "password", "building", buildingId);
}

/**
 * Deactivating a building cuts its sessions immediately — `credentialExists`
 * is re-checked on every request, so nobody keeps access until token expiry.
 */
export async function setBuildingActive(buildingId: string, isActive: boolean) {
  const session = await requireAdmin();
  await db.update(buildings).set({ isActive }).where(eq(buildings.id, buildingId));
  await record(session, isActive ? "activate" : "deactivate", "building", buildingId);
}

/** Sensor name and calibration. Offsets are applied once, in the DAL, on read. */
export async function updateSensor(input: {
  id: string;
  name: string;

}) {
  const session = await requireAdmin();

  await db
    .update(sensors)
    .set({ name: input.name })
    .where(eq(sensors.id, input.id));

  await record(session, "update", "sensor", input.id, {
    name: input.name,
  });
}

/**
 * Every building with a live health summary.
 *
 * Two grouped queries rather than correlated subqueries in the SELECT list:
 * the counts are then obviously right, and a wrong one shows up as a missing
 * key instead of a silent zero.
 */
export async function buildingsOverview() {
  await requireAdmin();

  const [buildingRows, sensorRows, alertRows] = await Promise.all([
    db
      .select({ id: buildings.id, name: buildings.name, isActive: buildings.isActive })
      .from(buildings)
      .orderBy(asc(buildings.name)),
    db
      .select({ buildingId: sensors.buildingId, n: sql<number>`count(*)` })
      .from(sensors)
      .where(and(eq(sensors.isActive, true), sql`${sensors.roomId} is not null`))
      .groupBy(sensors.buildingId),
    db
      .select({
        buildingId: alerts.buildingId,
        kind: alerts.kind,
        severity: alerts.severity,
        n: sql<number>`count(*)`,
      })
      .from(alerts)
      .where(ne(alerts.state, "resolved"))
      .groupBy(alerts.buildingId, alerts.kind, alerts.severity),
  ]);

  const sensorCounts = new Map(sensorRows.map((r) => [r.buildingId, Number(r.n)]));

  const tally = new Map<string, { open: number; critical: number; offline: number }>();
  for (const row of alertRows) {
    const entry = tally.get(row.buildingId) ?? { open: 0, critical: 0, offline: 0 };
    const n = Number(row.n);
    entry.open += n;
    if (row.severity === "critical") entry.critical += n;
    if (row.kind === "offline") entry.offline += n;
    tally.set(row.buildingId, entry);
  }

  return buildingRows.map((b) => {
    const counts = tally.get(b.id) ?? { open: 0, critical: 0, offline: 0 };
    return {
      id: b.id,
      name: b.name,
      isActive: b.isActive,
      sensorCount: sensorCounts.get(b.id) ?? 0,
      openAlerts: counts.open,
      criticalAlerts: counts.critical,
      offline: counts.offline,
    };
  });
}

/** Recent admin activity. Read-only — the log is never edited or trimmed here. */
export async function recentAudit(limit = 100) {
  await requireAdmin();

  return db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      actorKind: auditLog.actorKind,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      meta: auditLog.meta,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.at))
    .limit(limit);
}
