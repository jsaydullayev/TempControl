import "server-only";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { floors } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import { canSeeBuilding, resolveBuildingId, type Session } from "@/server/auth/dal";

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

  /*
   * An unusable cookie falls back to the default building instead of 404-ing.
   *
   * It names a building that was deleted, or a stale id left by a reseed, and
   * every admin page resolves it — including /admin/buildings, the one page
   * that could fix the selection. The panel locked itself with no way back but
   * clearing cookies by hand. A preference that cannot be honoured is simply
   * not a preference; a URL parameter naming a foreign building still 404s,
   * because that is a probe rather than a stale setting.
   */
  const requested = (await cookies()).get(BUILDING_COOKIE)?.value;
  const usable = requested && isUuid(requested) && canSeeBuilding(session, requested);
  return resolveBuildingId(session, usable ? requested : null);
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

/**
 * Null means "all floors" — the default, since a viewer may see everything.
 *
 * A malformed cookie is treated as an ABSENT one, not as a query. Postgres
 * rejects a non-uuid with a type error rather than an empty result, so passing
 * the raw value through turned a stale cookie — one left behind by a reseed, or
 * simply edited by hand — into a 500 on every page that reads it. The comment
 * above promises that these cookies cannot do harm; this is what makes it true.
 */
export async function currentFloorId(buildingId: string): Promise<string | null> {
  const requested = (await cookies()).get(FLOOR_COOKIE)?.value;
  if (!requested || !isUuid(requested) || !isUuid(buildingId)) return null;

  const [floor] = await db
    .select({ id: floors.id })
    .from(floors)
    .where(and(eq(floors.id, requested), eq(floors.buildingId, buildingId)))
    .limit(1);

  return floor ? floor.id : null;
}
