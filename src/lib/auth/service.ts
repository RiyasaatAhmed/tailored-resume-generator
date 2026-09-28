import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  emailVerificationTokens,
  subscriptions,
  users,
} from "@/db/schema";
import {
  VERIFICATION_TOKEN_TTL_MS,
  createOneTimeToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./password";
import type { SessionPayload } from "./session";

/**
 * Auth operations against the database, with no HTTP or cookie concerns — so
 * they can be tested directly against a container. The route handlers do the
 * cookie work.
 */

export const TRIAL_PLAN_CODE = "trial";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | "email_taken"
      | "invalid_credentials"
      | "invalid_token"
      | "token_expired",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface SignUpResult {
  user: { id: string; email: string; tokenVersion: number };
  /** The raw token for the verification link. Never persisted. */
  verificationToken: string;
}

/**
 * Creates the user, their trial subscription, and a verification token in one
 * transaction. The subscription is not optional: `data-model.md` says one row
 * per user created at signup on the trial plan, and the quota reserve reads it
 * on every generation.
 */
export async function signUp(
  db: Database,
  input: { email: string; password: string },
): Promise<SignUpResult> {
  const passwordHash = await hashPassword(input.password);
  const { token, tokenHash } = createOneTimeToken();

  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: input.email, passwordHash })
        .returning();

      await tx.insert(subscriptions).values({
        userId: user.id,
        planCode: TRIAL_PLAN_CODE,
        status: "trialing",
      });

      await tx.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          tokenVersion: user.tokenVersion,
        },
        verificationToken: token,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthError("That email is already registered", "email_taken");
    }
    throw error;
  }
}

/**
 * Verifies credentials. Runs argon2 even when the email is unknown, so response
 * timing does not reveal which addresses have accounts.
 */
export async function logIn(
  db: Database,
  input: { email: string; password: string },
): Promise<SessionPayload> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    await hashPassword(input.password);
    throw new AuthError("Email or password is incorrect", "invalid_credentials");
  }

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    throw new AuthError("Email or password is incorrect", "invalid_credentials");
  }

  return { userId: user.id, tokenVersion: user.tokenVersion };
}

/**
 * Resolves a session payload to a live user.
 *
 * Returns null when `tokenVersion` no longer matches — that comparison is what
 * makes "log out everywhere" work without a session table, and skipping it
 * would leave revoked tokens valid until they expire.
 */
export async function getUserForSession(
  db: Database,
  session: SessionPayload | null,
) {
  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) return null;
  if (user.tokenVersion !== session.tokenVersion) return null;
  return user;
}

/** Bumps `token_version`, invalidating every outstanding JWT for this user. */
export async function revokeAllSessions(db: Database, userId: string) {
  const [user] = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;

  await db
    .update(users)
    .set({ tokenVersion: user.tokenVersion + 1, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Issues a fresh verification token, invalidating any outstanding ones.
 *
 * Marking the old tokens consumed matters: without it, an old link forwarded to
 * someone else or sitting in a compromised mailbox stays usable for its full
 * 24 hours after the user has asked for a new one.
 *
 * Returns null if the address is already verified, so the caller can avoid
 * sending a pointless email.
 */
export async function issueVerificationToken(
  db: Database,
  userId: string,
): Promise<string | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.emailVerifiedAt) return null;

  const { token, tokenHash } = createOneTimeToken();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.consumedAt),
        ),
      );

    await tx.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });
  });

  return token;
}

/**
 * Consumes a verification token. Consumed rows are kept rather than deleted so
 * a reused link can say "already used" instead of "invalid".
 */
export async function verifyEmail(db: Database, token: string) {
  const tokenHash = hashToken(token);

  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.consumedAt),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AuthError("That link is invalid or has expired", "invalid_token");
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(eq(emailVerificationTokens.id, row.id));

    await tx
      .update(users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(eq(users.id, row.userId));
  });

  return row.userId;
}

/**
 * Postgres unique_violation.
 *
 * Walks the `cause` chain: Drizzle wraps driver errors in its own query error,
 * so the pg error code is not on the object it throws.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: string }).code === "23505"
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
