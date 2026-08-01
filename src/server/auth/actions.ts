"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { findCredential } from "@/server/auth/credentials";
import { verifyPassword } from "@/server/auth/password";
import { clearSessionCookie, setSessionCookie } from "@/server/auth/session";

const credentials = z.object({
  login: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export interface LoginState {
  error?: "invalid" | "throttled";
}

/**
 * Naive per-login throttle. Enough to stop credential stuffing in phase 1;
 * phase 3 moves the counter into the database alongside the audit log.
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentials.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
  });

  // A malformed submission is reported exactly like a wrong password: the form
  // must never reveal which field was at fault.
  if (!parsed.success) return { error: "invalid" };

  const key = parsed.data.login.toLowerCase();
  if (throttled(key)) return { error: "throttled" };

  const credential = await findCredential(parsed.data.login);
  if (!credential) return { error: "invalid" };

  const ok = await verifyPassword(parsed.data.password, credential.passwordHash);
  if (!ok) return { error: "invalid" };

  attempts.delete(key);
  await setSessionCookie({ kind: credential.kind, buildingId: credential.buildingId });

  // The session lasts a year, so this is the last time this device sees a form.
  redirect(credential.kind === "admin" ? "/admin" : "/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
