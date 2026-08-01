import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { buildings } from "@/db/schema";
import type { Building } from "@/lib/types";
import { isUuid } from "@/lib/uuid";
import { SESSION_COOKIE, readSessionToken } from "@/server/auth/session";
import { credentialExists, type PrincipalKind } from "@/server/auth/credentials";

/**
 * The Data Access Layer. Every read takes a Session, so a query can never be
 * written without a scope — and for this app the scope is the BUILDING.
 *
 * `proxy.ts` is only a first filter; it cannot reach the database. Real
 * authorisation happens here and is re-run inside every page, route handler
 * and server action.
 */

export interface Session {
  kind: PrincipalKind;
  isAdmin: boolean;
  /** The building this session may see. Admin sessions carry null. */
  buildingId: string | null;
  building: Building | null;
  /** Every building the session may look at — one, or all of them for an admin. */
  buildings: Building[];
}

export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await readSessionToken(token);
  if (!payload) return null;

  // Re-check the credential on every request: a deactivated building must lose
  // access immediately, not a year later when the JWT expires.
  const stillValid = await credentialExists(payload.kind, payload.buildingId);
  if (!stillValid) return null;

  if (payload.kind === "admin") {
    const all = await db
      .select({ id: buildings.id, slug: buildings.slug, name: buildings.name })
      .from(buildings)
      .where(eq(buildings.isActive, true))
      .orderBy(asc(buildings.name));

    return { kind: "admin", isAdmin: true, buildingId: null, building: null, buildings: all };
  }

  if (!isUuid(payload.buildingId)) return null;

  const [building] = await db
    .select({ id: buildings.id, slug: buildings.slug, name: buildings.name })
    .from(buildings)
    .where(eq(buildings.id, payload.buildingId))
    .limit(1);

  if (!building) return null;

  return {
    kind: "building",
    isAdmin: false,
    buildingId: building.id,
    building,
    buildings: [building],
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  // 404 rather than 403: a building session should not learn the admin area exists.
  if (!session.isAdmin) notFound();
  return session;
}

export function visibleBuildings(session: Session): Building[] {
  return session.buildings;
}

export function canSeeBuilding(session: Session, buildingId: string): boolean {
  if (session.isAdmin) return true;
  return session.buildingId === buildingId;
}

/**
 * Resolve a requested building against the session.
 * Anything outside scope is indistinguishable from "does not exist".
 */
export function resolveBuildingId(session: Session, requested?: string | null): string {
  if (requested) {
    if (!canSeeBuilding(session, requested)) notFound();
    return requested;
  }
  if (session.buildingId) return session.buildingId;

  // Admin with no explicit selection falls back to the first building.
  const first = session.buildings[0];
  if (!first) notFound();
  return first.id;
}
