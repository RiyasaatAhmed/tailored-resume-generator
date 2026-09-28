import "server-only";
import { cookies } from "next/headers";

import { getDatabase } from "@/db/client";
import { getUserForSession } from "./service";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  decodeSession,
  encodeSession,
  sessionCookieOptions,
  type SessionPayload,
} from "./session";

/**
 * Cookie-bound session helpers.
 *
 * `cookies()` is async in this version of Next — see
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md.
 * It can only be written from a Server Action or Route Handler, not while
 * rendering a page.
 */

export async function setSessionCookie(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const token = await encodeSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The current user, or null. Re-checks `token_version` against the database on
 * every call, so a revoked token stops working immediately rather than when it
 * expires.
 */
export async function getCurrentUser() {
  const session = await readSession();
  return getUserForSession(getDatabase(), session);
}
