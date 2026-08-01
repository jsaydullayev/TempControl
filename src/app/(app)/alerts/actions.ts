"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { acknowledgeAlert, markAlertsSeen } from "@/server/alerts/evaluate";
import { requireSession } from "@/server/auth/dal";
import { alertInScope } from "@/server/dal/alerts";
import { currentBuildingId } from "@/server/dal/view-selection";

/**
 * Acknowledging is a write, so it re-authorises here and confirms the alert
 * belongs to a building this session may act on — a server action is a public
 * endpoint, and the id comes from the client.
 */
export async function acknowledgeAction(formData: FormData) {
  const session = await requireSession();

  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const alertId = await alertInScope(session, parsed.data.id);
  await acknowledgeAlert(alertId, session.isAdmin ? "admin" : (session.buildingId ?? "building"));

  revalidatePath("/alerts");
  revalidatePath("/", "layout");
}

/** Clears the bell badge for the current building. */
export async function markSeenAction() {
  const session = await requireSession();
  const buildingId = await currentBuildingId(session);

  await markAlertsSeen(buildingId);
  revalidatePath("/", "layout");
}
