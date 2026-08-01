import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { admins, buildings } from "@/db/schema";
import { isUuid } from "@/lib/uuid";

/**
 * Access is granted per BUILDING, not per person. One credential unlocks one
 * building; a separate admin credential unlocks management of all of them.
 */

export type PrincipalKind = "building" | "admin";

export interface Credential {
  kind: PrincipalKind;
  passwordHash: string;
  /** Set for building credentials, absent for the admin credential. */
  buildingId?: string;
}

export async function findCredential(login: string): Promise<Credential | null> {
  const normalised = login.trim().toLowerCase();

  const [building] = await db
    .select({ id: buildings.id, passwordHash: buildings.passwordHash })
    .from(buildings)
    .where(and(eq(buildings.login, normalised), eq(buildings.isActive, true)))
    .limit(1);

  if (building) {
    return { kind: "building", passwordHash: building.passwordHash, buildingId: building.id };
  }

  const [admin] = await db
    .select({ passwordHash: admins.passwordHash })
    .from(admins)
    .where(and(eq(admins.login, normalised), eq(admins.isActive, true)))
    .limit(1);

  return admin ? { kind: "admin", passwordHash: admin.passwordHash } : null;
}

/**
 * Re-checked on every request so a deactivated building or a revoked admin
 * loses access immediately, rather than when the year-long token expires.
 */
export async function credentialExists(
  kind: PrincipalKind,
  buildingId: string | undefined,
): Promise<boolean> {
  if (kind === "admin") {
    const [admin] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.isActive, true))
      .limit(1);
    return Boolean(admin);
  }

  // A session token outlives a reseed, so the id it carries may no longer be a
  // uuid at all — treat that exactly like a building that no longer exists.
  if (!isUuid(buildingId)) return false;

  const [building] = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.isActive, true)))
    .limit(1);

  return Boolean(building);
}
