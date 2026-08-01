/**
 * Checks the Tuya signing rules that fail SILENTLY when broken — a wrong
 * signature returns error 1004 with no hint about which rule was violated.
 *
 * Run with: npm run verify:sign
 */
import { createHash } from "node:crypto";

import { signRequest, EMPTY_BODY_SHA256 } from "../src/server/providers/tuya/sign";

const BASE = "https://openapi.tuyaeu.com";
const CID = "cid";
const SECRET = "sec";
const T = 1_700_000_000_000;

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${ok || !detail ? "" : `  → ${detail}`}`);
  if (!ok) failures++;
}

// 1. The empty body hashes the empty string, not "{}".
check(
  "empty body SHA256",
  EMPTY_BODY_SHA256 === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  EMPTY_BODY_SHA256,
);

// 2. Signature is uppercase hex.
const token = signRequest({
  baseUrl: BASE,
  method: "GET",
  path: "/v1.0/token",
  query: { grant_type: 1 },
  clientId: CID,
  clientSecret: SECRET,
  now: T,
});
check("signature is uppercase hex", /^[0-9A-F]{64}$/.test(token.headers.sign), token.headers.sign);

// 3. Token requests carry no access_token header.
check("token request has no access_token", token.headers.access_token === undefined);

// 4. Business requests do carry it, and sign differently.
const business = signRequest({
  baseUrl: BASE,
  method: "GET",
  path: "/v1.0/token",
  query: { grant_type: 1 },
  clientId: CID,
  clientSecret: SECRET,
  accessToken: "TOK",
  now: T,
});
check("access_token changes the signature", business.headers.sign !== token.headers.sign);
check("business request sends access_token", business.headers.access_token === "TOK");

// 5. Query parameters are sorted lexicographically and the URL matches.
const sorted = signRequest({
  baseUrl: BASE,
  method: "GET",
  path: "/p",
  query: { zz: 1, aa: 2, mm: 3 },
  clientId: CID,
  clientSecret: SECRET,
  now: T,
});
check("query sorted lexicographically", sorted.url === `${BASE}/p?aa=2&mm=3&zz=1`, sorted.url);

// 6. No query means no trailing "?".
const bare = signRequest({
  baseUrl: BASE,
  method: "GET",
  path: "/p",
  query: {},
  clientId: CID,
  clientSecret: SECRET,
  now: T,
});
check("empty query adds no '?'", bare.url === `${BASE}/p`, bare.url);

// 7. The body that is hashed is the body that is sent.
const posted = signRequest({
  baseUrl: BASE,
  method: "POST",
  path: "/p",
  body: { a: 1 },
  clientId: CID,
  clientSecret: SECRET,
  now: T,
});
check("body serialised once", posted.body === '{"a":1}', String(posted.body));
check(
  "content type set for a body",
  posted.headers["Content-Type"] === "application/json",
);
check(
  "body hash matches the sent bytes",
  createHash("sha256").update(posted.body!).digest("hex") ===
    createHash("sha256").update('{"a":1}').digest("hex"),
);

// 8. Timestamp is the 13-digit millisecond value, as a string.
check("t is 13-digit ms string", token.headers.t === String(T), token.headers.t);

console.log(failures === 0 ? "\nAll signing rules hold." : `\n${failures} rule(s) broken.`);
process.exit(failures === 0 ? 0 : 1);
