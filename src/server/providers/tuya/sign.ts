import { createHash, createHmac } from "node:crypto";

/**
 * Tuya OpenAPI request signing.
 *
 * Verified against Tuya's "Sign Requests for Cloud Authorization" doc and two
 * official SDKs. The details below are the ones that silently produce error
 * 1004 when they are wrong:
 *
 *  - stringToSign is `METHOD \n Content-SHA256 \n SignatureHeaders \n Url`,
 *    and with no signed headers that middle slot is EMPTY — the string keeps a
 *    blank line before the Url.
 *  - Content-SHA256 is LOWERCASE hex; the final signature is UPPERCASE hex.
 *  - An empty body hashes the empty string, not "{}".
 *  - Query parameters are sorted lexicographically, and the exact same string
 *    must go on the wire — build it once, use it twice.
 *  - Both official SDKs send no nonce and concatenate an empty one. We do the
 *    same: it is the most battle-tested configuration.
 */

const EMPTY_BODY_SHA256 = createHash("sha256").update("").digest("hex");

export interface SignedRequest {
  /** Absolute URL to fetch, identical to what was signed. */
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface SignInput {
  baseUrl: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  clientId: string;
  clientSecret: string;
  /** Omitted for the token endpoints, which are signed without it. */
  accessToken?: string;
  /** Injectable so the caller can freeze time in tests. */
  now?: number;
}

/** Sorted, encoded query string — or "" when there are no parameters. */
function canonicalQuery(query: SignInput["query"]): string {
  if (!query) return "";
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

export function signRequest(input: SignInput): SignedRequest {
  const t = String(input.now ?? Date.now());
  const nonce = "";

  // Serialise once: the bytes that are hashed must be the bytes that are sent.
  const bodyString = input.body === undefined ? "" : JSON.stringify(input.body);
  const contentSha256 =
    bodyString === "" ? EMPTY_BODY_SHA256 : createHash("sha256").update(bodyString).digest("hex");

  const query = canonicalQuery(input.query);
  const urlPath = query ? `${input.path}?${query}` : input.path;

  // The empty third slot is intentional — it leaves a blank line before the Url.
  const stringToSign = [input.method, contentSha256, "", urlPath].join("\n");

  const payload =
    input.clientId + (input.accessToken ?? "") + t + nonce + stringToSign;

  const sign = createHmac("sha256", input.clientSecret)
    .update(payload, "utf8")
    .digest("hex")
    .toUpperCase();

  const headers: Record<string, string> = {
    client_id: input.clientId,
    sign,
    sign_method: "HMAC-SHA256",
    t,
  };
  if (input.accessToken) headers.access_token = input.accessToken;
  if (bodyString) headers["Content-Type"] = "application/json";

  return {
    url: `${input.baseUrl.replace(/\/$/, "")}${urlPath}`,
    headers,
    body: bodyString || undefined,
  };
}

export { EMPTY_BODY_SHA256 };
