import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";

/**
 * argon2id, per `tech.md`. Defaults follow the OWASP recommendation rather
 * than the library's, which is tuned for throughput.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plaintext, ARGON2_OPTIONS);
  } catch {
    // A malformed stored hash must read as "wrong password", not crash the
    // login route.
    return false;
  }
}

/**
 * One-time tokens for email verification and password reset.
 *
 * The data model is explicit: store the **hash**, never the token. The raw
 * value goes in the emailed link and is never persisted, so a database leak
 * cannot be replayed into account takeover.
 */
export function createOneTimeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  // sha256 rather than argon2: these are high-entropy random values, not
  // human-chosen secrets, so a slow KDF buys nothing and costs a lookup.
  return createHash("sha256").update(token).digest("hex");
}

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
