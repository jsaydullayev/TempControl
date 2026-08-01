"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { floors } from "@/db/schema";
import { canSeeBuilding, requireSession } from "@/server/auth/dal";
import { BUILDING_COOKIE, FLOOR_COOKIE } from "@/server/dal/view-selection";

const YEAR = 60 * 60 * 24 * 365;

/** Floor filter. Empty value means "all floors". */
export async function setFloorAction(formData: FormData): Promise<void> {
  // Re-authorise inside the action: a server action is a public endpoint.
  const session = await requireSession();
  const store = await cookies();

  const value = formData.get("floorId");
  if (typeof value !== "string" || value === "") {
    store.delete(FLOOR_COOKIE);
    revalidatePath("/", "layout");
    return;
  }

  const [floor] = await db
    .select({ buildingId: floors.buildingId })
    .from(floors)
    .where(eq(floors.id, value))
    .limit(1);

  if (!floor || !canSeeBuilding(session, floor.buildingId)) return;

  store.set(FLOOR_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Admin-only: switch which building the admin is inspecting. */
export async function setBuildingAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.isAdmin) return;

  const value = formData.get("buildingId");
  if (typeof value !== "string" || !canSeeBuilding(session, value)) return;

  const store = await cookies();
  store.set(BUILDING_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  // Floor ids belong to a building, so the old selection is no longer meaningful.
  store.delete(FLOOR_COOKIE);
  revalidatePath("/", "layout");
}
