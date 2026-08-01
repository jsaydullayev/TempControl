import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * scrypt from node:crypto rather than bcrypt/argon2 — both of those need a
 * native toolchain, which is a recurring build failure on Windows dev machines.
 */
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCHEME = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${SCHEME}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== SCHEME || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const key = (await scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH)) as Buffer;

  // Length check first: timingSafeEqual throws on mismatched lengths.
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}
