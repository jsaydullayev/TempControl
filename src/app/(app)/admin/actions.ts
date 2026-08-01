"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  bindDeviceToRoom,
  createBuilding,
  createDepartment,
  createFloor,
  createRoom,
  deactivate,
  rename,
  renameSensor,
  saveThreshold,
  clearThreshold,
  setBuildingActive,
  setBuildingPassword,
  unbindSensor,
  updateSensor,
} from "@/server/dal/admin";

/**
 * Server actions for the structure editor.
 *
 * Each one only parses input; authorisation lives in the DAL functions, which
 * re-check `requireAdmin()` themselves — a server action is a public endpoint.
 */

const name = z.string().trim().min(1).max(120);
const id = z.string().uuid();

function refresh() {
  revalidatePath("/", "layout");
}

export async function addFloorAction(formData: FormData) {
  const parsed = z.object({ buildingId: id, name }).safeParse({
    buildingId: formData.get("buildingId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  await createFloor(parsed.data.buildingId, parsed.data.name);
  refresh();
}

export async function addDepartmentAction(formData: FormData) {
  const parsed = z.object({ buildingId: id, floorId: id, name }).safeParse({
    buildingId: formData.get("buildingId"),
    floorId: formData.get("floorId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  await createDepartment(parsed.data.buildingId, parsed.data.floorId, parsed.data.name);
  refresh();
}

export async function addRoomAction(formData: FormData) {
  const parsed = z.object({ departmentId: id, name }).safeParse({
    departmentId: formData.get("departmentId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  await createRoom(parsed.data.departmentId, parsed.data.name);
  refresh();
}

export async function renameAction(formData: FormData) {
  const parsed = z
    .object({ entity: z.enum(["floor", "department", "room"]), id, name })
    .safeParse({
      entity: formData.get("entity"),
      id: formData.get("id"),
      name: formData.get("name"),
    });
  if (!parsed.success) return;

  await rename(parsed.data.entity, parsed.data.id, parsed.data.name);
  refresh();
}

export async function deactivateAction(formData: FormData) {
  const parsed = z.object({ entity: z.enum(["floor", "department", "room"]), id }).safeParse({
    entity: formData.get("entity"),
    id: formData.get("id"),
  });
  if (!parsed.success) return;

  await deactivate(parsed.data.entity, parsed.data.id);
  refresh();
}

export async function bindDeviceAction(formData: FormData) {
  const parsed = z
    .object({
      externalId: z.string().trim().min(1).max(128),
      roomId: id,
      // Optional: blank means "name it after the room".
      name: z.string().trim().max(120).optional(),
    })
    .safeParse({
      externalId: formData.get("externalId"),
      roomId: formData.get("roomId"),
      name: formData.get("name") ?? undefined,
    });
  if (!parsed.success) return;

  await bindDeviceToRoom(parsed.data.externalId, parsed.data.roomId, parsed.data.name);
  refresh();
}

export async function unbindSensorAction(formData: FormData) {
  const parsed = z.object({ id }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  await unbindSensor(parsed.data.id);
  refresh();
}

export async function renameSensorAction(formData: FormData) {
  const parsed = z.object({ id, name }).safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  await renameSensor(parsed.data.id, parsed.data.name);
  refresh();
}

const thresholdInput = z.object({
  scope: z.enum(["building", "sensor"]),
  scopeId: id,
  metric: z.enum(["temp", "hum"]),
  min: z.coerce.number().min(-100).max(200),
  max: z.coerce.number().min(-100).max(200),
  hysteresis: z.coerce.number().min(0).max(20),
  sustainMinutes: z.coerce.number().int().min(0).max(600),
});

export async function saveThresholdAction(formData: FormData) {
  const parsed = thresholdInput.safeParse({
    scope: formData.get("scope"),
    scopeId: formData.get("scopeId"),
    metric: formData.get("metric"),
    min: formData.get("min"),
    max: formData.get("max"),
    hysteresis: formData.get("hysteresis"),
    sustainMinutes: formData.get("sustainMinutes"),
  });
  // A min above the max would mean "always breaching" — refuse rather than save it.
  if (!parsed.success || parsed.data.min >= parsed.data.max) return;

  await saveThreshold(parsed.data);
  refresh();
}

export async function clearThresholdAction(formData: FormData) {
  const parsed = z
    .object({ scope: z.enum(["building", "sensor"]), scopeId: id, metric: z.enum(["temp", "hum"]) })
    .safeParse({
      scope: formData.get("scope"),
      scopeId: formData.get("scopeId"),
      metric: formData.get("metric"),
    });
  if (!parsed.success) return;

  await clearThreshold(parsed.data.scope, parsed.data.scopeId, parsed.data.metric);
  refresh();
}

export async function createBuildingAction(formData: FormData) {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      login: z.string().trim().min(2).max(64).regex(/^[a-zA-Z0-9._-]+$/),
      // Eight characters minimum: this credential is shared by a whole building
      // and lives for a year, so a four-digit one would be guessed in an afternoon.
      password: z.string().min(8).max(256),
    })
    .safeParse({
      name: formData.get("name"),
      login: formData.get("login"),
      password: formData.get("password"),
    });
  if (!parsed.success) return;

  const result = await createBuilding(parsed.data);
  if (!result.ok) redirect("/admin/buildings?error=taken");

  refresh();
  redirect("/admin/buildings");
}

export async function setBuildingPasswordAction(formData: FormData) {
  const parsed = z.object({ id, password: z.string().min(8).max(256) }).safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });
  if (!parsed.success) return;

  await setBuildingPassword(parsed.data.id, parsed.data.password);
  refresh();
}

export async function setBuildingActiveAction(formData: FormData) {
  const parsed = z.object({ id, active: z.enum(["0", "1"]) }).safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  await setBuildingActive(parsed.data.id, parsed.data.active === "1");
  refresh();
}

export async function updateSensorAction(formData: FormData) {
  const parsed = z
    .object({
      id,
      name,
      tempOffset: z.coerce.number().min(-20).max(20),
      humOffset: z.coerce.number().min(-40).max(40),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      tempOffset: formData.get("tempOffset"),
      humOffset: formData.get("humOffset"),
    });
  if (!parsed.success) return;

  await updateSensor(parsed.data);
  refresh();
}
