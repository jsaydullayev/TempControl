import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

import type { PrincipalKind } from "@/server/auth/credentials";

export const SESSION_COOKIE = "tc_session";

/**
 * A device signs in once and stays signed in for a year — the whole point of
 * the building-credential model is that a wall display or a shared office PC is
 * not asked for a password every morning. Signing out is the explicit escape.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET is required in production");
    }
    // Dev-only fallback so the app runs straight after clone.
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-32chars");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  kind: PrincipalKind;
  /** Present for building sessions; absent for the admin session. */
  buildingId?: string;
}

export async function issueSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const kind = payload.kind;
    if (kind !== "building" && kind !== "admin") return null;

    const buildingId = payload.buildingId;
    if (kind === "building" && typeof buildingId !== "string") return null;

    return { kind, buildingId: typeof buildingId === "string" ? buildingId : undefined };
  } catch {
    return null;
  }
}

/**
 * `Secure` follows the ACTUAL protocol, not NODE_ENV.
 *
 * Keying it to NODE_ENV meant a production container reached over plain HTTP —
 * by IP, before a domain and certificate exist — set a Secure cookie that the
 * browser then refuses to store. Login appeared to succeed and every page after
 * it bounced back to the form, with nothing in any log to explain why.
 *
 * nginx passes X-Forwarded-Proto (see deploy/nginx-tempcontrol.conf), so behind
 * HTTPS the flag comes back on by itself.
 */
async function servedOverHttps(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  return proto?.split(",")[0].trim() === "https";
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await issueSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await servedOverHttps(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
