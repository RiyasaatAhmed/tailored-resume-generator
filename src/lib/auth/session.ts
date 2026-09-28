import { SignJWT, jwtVerify } from "jose";

/**
 * Stateless sessions: a signed JWT in an httpOnly cookie, no session table.
 *
 * Shape follows the Next.js authentication guide's stateless-session pattern
 * (node_modules/next/dist/docs/01-app/02-guides/authentication.md), which is
 * also what `tech.md` specifies — `jose`, HS256, httpOnly cookie.
 *
 * `tokenVersion` is the whole logout-everywhere mechanism: it rides in the
 * claims and is compared against the database on each request, so bumping the
 * column invalidates every outstanding token at once.
 */

export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionPayload {
  userId: string;
  tokenVersion: number;
}

function getKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function encodeSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + SESSION_TTL_MS))
    .sign(getKey());
}

/** Returns null on anything invalid — expired, tampered, wrong algorithm. */
export async function decodeSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      // Pinned: without this, a token with alg "none" would verify.
      algorithms: ["HS256"],
    });
    const { userId, tokenVersion } = payload as Partial<SessionPayload>;
    if (typeof userId !== "string" || typeof tokenVersion !== "number") {
      return null;
    }
    return { userId, tokenVersion };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // Off in dev so the cookie survives plain-HTTP localhost.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
