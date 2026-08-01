import "server-only";

import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { alerts, departments, rooms, sensors } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import type { Severity } from "@/lib/types";
import { canSeeBuilding, type Session } from "@/server/auth/dal";
import { notFound } from "next/navigation";

/** Scoped alert reads. Like every DAL function, the session comes first. */

export type AlertKind = "temp" | "hum" | "offline" | "battery";
export type AlertState = "open" | "ack" | "resolved";

export interface AlertRow {
  id: string;
  sensorId: string;
  sensorName: string;
  roomName: string;
  departmentName: string;
  kind: AlertKind;
  state: AlertState;
  severity: Severity;
  direction: "below" | "above" | null;
  openedAt: number;
  resolvedAt: number | null;
  value: number | null;
  seen: boolean;
}

function shape(row: {
  id: string;
  sensorId: string;
  sensorName: string;
  roomName: string | null;
  departmentName: string | null;
  kind: string;
  state: string;
  severity: string;
  direction: string | null;
  openedAt: Date;
  resolvedAt: Date | null;
  lastValue: number | null;
  seenAt: Date | null;
}): AlertRow {
  return {
    id: row.id,
    sensorId: row.sensorId,
    sensorName: row.sensorName,
    roomName: row.roomName ?? "",
    departmentName: row.departmentName ?? "",
    kind: row.kind as AlertKind,
    state: row.state as AlertState,
    severity: row.severity as Severity,
    direction: (row.direction as "below" | "above" | null) ?? null,
    openedAt: row.openedAt.getTime(),
    resolvedAt: row.resolvedAt?.getTime() ?? null,
    value: row.lastValue,
    seen: row.seenAt !== null,
  };
}

const COLUMNS = {
  id: alerts.id,
  sensorId: alerts.sensorId,
  sensorName: sensors.name,
  roomName: rooms.name,
  departmentName: departments.name,
  kind: alerts.kind,
  state: alerts.state,
  severity: alerts.severity,
  direction: alerts.direction,
  openedAt: alerts.openedAt,
  resolvedAt: alerts.resolvedAt,
  lastValue: alerts.lastValue,
  seenAt: alerts.seenAt,
};

export async function listAlerts(
  session: Session,
  buildingId: string,
  options: { includeResolved?: boolean; limit?: number } = {},
): Promise<AlertRow[]> {
  if (!isUuid(buildingId) || !canSeeBuilding(session, buildingId)) notFound();

  const conditions = [eq(alerts.buildingId, buildingId)];
  if (!options.includeResolved) conditions.push(ne(alerts.state, "resolved"));

  const rows = await db
    .select(COLUMNS)
    .from(alerts)
    .innerJoin(sensors, eq(sensors.id, alerts.sensorId))
    .leftJoin(rooms, eq(rooms.id, sensors.roomId))
    .leftJoin(departments, eq(departments.id, rooms.departmentId))
    .where(and(...conditions))
    .orderBy(desc(alerts.openedAt))
    .limit(options.limit ?? 200);

  return rows.map(shape);
}

/** Live alerts for the bell, newest first. */
export async function bellAlerts(session: Session, buildingId: string): Promise<AlertRow[]> {
  return listAlerts(session, buildingId, { limit: 20 });
}

export async function unseenCount(session: Session, buildingId: string): Promise<number> {
  if (!isUuid(buildingId) || !canSeeBuilding(session, buildingId)) notFound();

  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(alerts)
    .where(
      and(eq(alerts.buildingId, buildingId), ne(alerts.state, "resolved"), isNull(alerts.seenAt)),
    );

  return Number(row?.n ?? 0);
}

/** Confirms an alert belongs to a building the session may act on. */
export async function alertInScope(session: Session, alertId: string): Promise<string> {
  if (!isUuid(alertId)) notFound();

  const [row] = await db
    .select({ id: alerts.id, buildingId: alerts.buildingId })
    .from(alerts)
    .where(eq(alerts.id, alertId))
    .limit(1);

  if (!row || !canSeeBuilding(session, row.buildingId)) notFound();
  return row.id;
}
