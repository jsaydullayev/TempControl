import { signRequest } from "@/server/providers/tuya/sign";

/**
 * Thin Tuya OpenAPI client: signing, a process-wide token cache, and error
 * translation. Everything above it works in domain terms, not HTTP.
 */

export interface TuyaConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Only needed by the older /v1.0/users/{uid}/devices listing. */
  uid?: string;
}

export class TuyaError extends Error {
  constructor(
    readonly code: number | string,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "TuyaError";
  }
}

/** The failure modes that are worth naming, because the fix differs for each. */
const HINTS: Record<string, string> = {
  "1001": "Access Secret noto'g'ri.",
  "1004": "Imzo xato — token eskirgan (qayta olinadi) yoki Access Secret/region noto'g'ri.",
  "1010": "Token yaroqsiz — qayta olinadi.",
  "1013": "Server soati Tuya bilan mos emas (timestamp farqi).",
  "1106": "Ruxsat yo'q — Smart Life ilovasi QR kod orqali loyihaga bog'lanmagan.",
  "28841002": "IoT Core obunasi tugagan yoki API yoqilmagan.",
  "28841105": "Loyihaga bu API xizmati ulanmagan.",
};

interface TuyaResponse<T> {
  success: boolean;
  code?: number;
  msg?: string;
  t?: number;
  result?: T;
}

interface CachedToken {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

/**
 * One token per credential, parked on globalThis so Next.js dev reloads do not
 * request a fresh token on every file save.
 */
const globalForTuya = globalThis as unknown as {
  tuyaTokens?: Map<string, CachedToken>;
  tuyaTokenFlight?: Map<string, Promise<string>>;
};
const tokens = (globalForTuya.tuyaTokens ??= new Map());

/**
 * In-flight token requests, keyed the same way as the cache.
 *
 * A page render fires several Tuya calls at once. Without this, each of them
 * sees an empty cache and asks for its own token — and Tuya invalidates the
 * previous one every time it issues a new one, so the earlier requests come
 * back as "sign invalid" (1004). Single-flighting the fetch makes concurrent
 * callers share one token.
 */
const inFlight = (globalForTuya.tuyaTokenFlight ??= new Map());

/** Refresh a minute early: a token that expires mid-flight looks like error 1010. */
const EXPIRY_MARGIN_MS = 60_000;

function cacheKey(config: TuyaConfig): string {
  return `${config.baseUrl}:${config.clientId}`;
}

async function call<T>(
  config: TuyaConfig,
  init: {
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    accessToken?: string;
  },
): Promise<T> {
  const signed = signRequest({
    baseUrl: config.baseUrl,
    method: init.method,
    path: init.path,
    query: init.query,
    body: init.body,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    accessToken: init.accessToken,
  });

  let response: Response;
  try {
    response = await fetch(signed.url, {
      method: init.method,
      headers: signed.headers,
      body: signed.body,
      // Tuya data is live; a cached response would be a stale reading.
      cache: "no-store",
    });
  } catch (cause) {
    throw new TuyaError("network", `Tuya'ga ulanib bo'lmadi: ${String(cause)}`);
  }

  if (!response.ok) {
    throw new TuyaError(response.status, `Tuya HTTP ${response.status}`);
  }

  const payload = (await response.json()) as TuyaResponse<T>;
  if (!payload.success) {
    const code = String(payload.code ?? "unknown");
    throw new TuyaError(code, payload.msg ?? "Tuya xatosi", HINTS[code]);
  }
  return payload.result as T;
}

/**
 * The token endpoints are token-management APIs: they are signed WITHOUT an
 * access token. Signing the refresh call with the expired token is the single
 * most common cause of a 1004 during refresh.
 */
async function fetchToken(config: TuyaConfig): Promise<CachedToken> {
  const result = await call<{
    access_token: string;
    refresh_token: string;
    expire_time: number;
  }>(config, { method: "GET", path: "/v1.0/token", query: { grant_type: 1 } });

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + result.expire_time * 1000,
  };
}

async function refreshToken(config: TuyaConfig, refresh: string): Promise<CachedToken> {
  const result = await call<{
    access_token: string;
    refresh_token: string;
    expire_time: number;
  }>(config, { method: "GET", path: `/v1.0/token/${refresh}` });

  return {
    accessToken: result.access_token,
    // The refresh token is single-use — the new one must replace it.
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + result.expire_time * 1000,
  };
}

async function accessToken(config: TuyaConfig): Promise<string> {
  const key = cacheKey(config);
  const cached = tokens.get(key);

  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return cached.accessToken;
  }

  // Someone is already getting one — wait for it rather than racing them.
  const pending = inFlight.get(key);
  if (pending) return pending;

  const flight = (async () => {
    const previous = tokens.get(key);

    if (previous) {
      try {
        const refreshed = await refreshToken(config, previous.refreshToken);
        tokens.set(key, refreshed);
        return refreshed.accessToken;
      } catch {
        // A refused refresh is recoverable: fall through to a brand-new token.
        tokens.delete(key);
      }
    }

    const fresh = await fetchToken(config);
    tokens.set(key, fresh);
    return fresh.accessToken;
  })();

  inFlight.set(key, flight);
  try {
    return await flight;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Errors that mean "your token is no longer the current one" rather than
 * "your credentials are wrong". Both are worth one retry with a fresh token.
 *
 * 1004 belongs here because Tuya issues ONE live token per credential: the
 * moment any process asks for a new one, every other process's token stops
 * signing. In production the app and the worker share the same Access ID, so
 * opening the admin panel silently killed the poller's token and every cycle
 * after it failed with "sign invalid" — the readings simply stopped, with the
 * Tuya app still showing perfect data because nothing was wrong at the device.
 *
 * Single-flighting only fixes the race inside one process; across processes the
 * only workable answer is to notice and re-authenticate.
 */
const STALE_TOKEN_CODES = new Set(["1010", "1004"]);

/** Authenticated request. Retries once on an invalid-token error. */
export async function tuyaRequest<T>(
  config: TuyaConfig,
  init: {
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string | number | undefined>;
    body?: unknown;
  },
): Promise<T> {
  const token = await accessToken(config);

  try {
    return await call<T>(config, { ...init, accessToken: token });
  } catch (error) {
    if (error instanceof TuyaError && STALE_TOKEN_CODES.has(String(error.code))) {
      // Drop it so the retry fetches a brand-new token rather than refreshing
      // one the server has already forgotten.
      tokens.delete(cacheKey(config));
      const retryToken = await accessToken(config);
      return call<T>(config, { ...init, accessToken: retryToken });
    }
    throw error;
  }
}

/**
 * Reads credentials from the environment; null when they are not configured.
 *
 * Every value is TRIMMED. A `.env` written on Windows ends its lines with
 * CR+LF, and piping those lines to a Linux server leaves a carriage return
 * inside the value: the secret becomes "…c479\r", every signature is computed
 * over the wrong key, and Tuya answers "sign invalid" forever. Nothing in that
 * error points at an invisible character, so the cause is removed here instead.
 */
export function tuyaConfigFromEnv(): TuyaConfig | null {
  const clientId = process.env.TUYA_ACCESS_ID?.trim();
  const clientSecret = process.env.TUYA_ACCESS_SECRET?.trim();
  const baseUrl = process.env.TUYA_BASE_URL?.trim().replace(/\/+$/, "");

  if (!clientId || !clientSecret || !baseUrl) return null;
  return { clientId, clientSecret, baseUrl, uid: process.env.TUYA_UID?.trim() || undefined };
}

/** Drops the cached token — used after credentials change. */
export function forgetTuyaToken(config: TuyaConfig): void {
  tokens.delete(cacheKey(config));
}
