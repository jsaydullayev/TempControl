import "server-only";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { floors } from "@/db/schema";
import { resolveBuildingId, type Session } from "@/server/auth/dal";

export const BUILDING_COOKIE = "tc_building";
export const FLOOR_COOKIE = "tc_floor";

/**
 * Which building and floor the viewer is currently looking at.
 *
 * Both cookies are *preferences*, never authorisation inputs: they are always
 * validated against the session, so editing them by hand gains nothing.
 */
export async function currentBuildingId(session: Session): Promise<string> {
  // A building session is pinned to its own building — the cookie cannot move it.
  if (!session.isAdmin) return resolveBuildingId(session, null);

  const requested = (await cookies()).get(BUILDING_COOKIE)?.value;
  return resolveBuildingId(session, requested ?? null);
}

/**
 * The same choice, but tolerating an empty system.
 *
 * A fresh install has no buildings at all, and an admin has to be able to reach
 * the panel to create the first one — 404-ing the shared layout would lock the
 * whole app, including the page that fixes it.
 */
export async function currentBuildingIdOrNull(session: Session): Promise<string | null> {
  if (session.buildings.length === 0) return null;
  return currentBuildingId(session);
}

/** Null means "all floors" — the default, since a viewer may see everything. */
export async function currentFloorId(buildingId: string): Promise<string | null> {
  const requested = (await cookies()).get(FLOOR_COOKIE)?.value;
  if (!requested) return null;

  const [floor] = await db
    .select({ id: floors.id })
    .from(floors)
    .where(and(eq(floors.id, requested), eq(floors.buildingId, buildingId)))
    .limit(1);

  return floor ? floor.id : null;
}
