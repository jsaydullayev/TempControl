const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids reach the server from URLs, cookies and long-lived session tokens, so
 * they are not necessarily UUIDs — a session issued before a reseed can still
 * carry an id that no longer has that shape. Postgres raises a type error on a
 * malformed uuid, which would surface as a 500 instead of a clean "not found".
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
