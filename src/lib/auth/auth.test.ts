import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { emailVerificationTokens, plans, subscriptions, users } from "@/db/schema";
import { startTestDatabase, type TestDatabase } from "@/db/testing/container";
import {
  AuthError,
  getUserForSession,
  logIn,
  revokeAllSessions,
  signUp,
  verifyEmail,
} from "./service";
import { createOneTimeToken, hashPassword, hashToken, verifyPassword } from "./password";
import { decodeSession, encodeSession } from "./session";

let tdb: TestDatabase;

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long!!";
  tdb = await startTestDatabase();
}, 180_000);

afterAll(async () => {
  await tdb?.stop();
});

afterEach(async () => {
  await tdb.reset();
});

async function seedPlans() {
  await tdb.db.insert(plans).values({
    code: "trial",
    name: "Trial",
    priceCents: 0,
    generationLimit: 2,
    period: "lifetime",
    dailyCap: 2,
  });
}

describe("password hashing", () => {
  it("round-trips a password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "Correct Horse Battery Staple")).toBe(false);
  });

  it("produces a different hash each time, so the salt is doing its job", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "same-password")).toBe(true);
    expect(await verifyPassword(b, "same-password")).toBe(true);
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });

  it("never stores the raw one-time token", () => {
    const { token, tokenHash } = createOneTimeToken();
    expect(tokenHash).not.toContain(token);
    expect(hashToken(token)).toBe(tokenHash);
  });
});

describe("session tokens", () => {
  it("round-trips a payload", async () => {
    const token = await encodeSession({ userId: "abc", tokenVersion: 3 });
    expect(await decodeSession(token)).toMatchObject({
      userId: "abc",
      tokenVersion: 3,
    });
  });

  it("returns null for a tampered token", async () => {
    const token = await encodeSession({ userId: "abc", tokenVersion: 0 });
    expect(await decodeSession(token.slice(0, -3) + "aaa")).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await encodeSession({ userId: "abc", tokenVersion: 0 });
    process.env.SESSION_SECRET = "a-completely-different-secret-32-chars!!";
    const decoded = await decodeSession(token);
    process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long!!";
    expect(decoded).toBeNull();
  });

  it("returns null for undefined", async () => {
    expect(await decodeSession(undefined)).toBeNull();
  });
});

describe("signUp", () => {
  it("creates the user and a trial subscription together", async () => {
    await seedPlans();
    const { user } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });

    const [sub] = await tdb.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id));

    expect(sub.planCode).toBe("trial");
    expect(sub.status).toBe("trialing");
    // Lifetime trial has no period bounds.
    expect(sub.currentPeriodEnd).toBeNull();
  });

  it("leaves the account unverified, which gates the first generation", async () => {
    await seedPlans();
    const { user } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });
    const [row] = await tdb.db.select().from(users).where(eq(users.id, user.id));
    expect(row.emailVerifiedAt).toBeNull();
  });

  it("rejects a duplicate email regardless of casing", async () => {
    await seedPlans();
    await signUp(tdb.db, { email: "Casey@Example.com", password: "hunter2hunter2" });

    await expect(
      signUp(tdb.db, { email: "casey@example.com", password: "different-pw" }),
    ).rejects.toMatchObject({ code: "email_taken" });
  });

  // The transaction must not leave a user without a subscription: the quota
  // reserve reads that row on every generation.
  it("creates no user at all when the subscription cannot be created", async () => {
    // Plans are not seeded, so the FK on plan_code fails.
    await expect(
      signUp(tdb.db, { email: "casey@example.com", password: "hunter2hunter2" }),
    ).rejects.toThrow();

    expect(await tdb.db.select().from(users)).toHaveLength(0);
  });
});

describe("logIn", () => {
  it("returns a session payload for correct credentials", async () => {
    await seedPlans();
    const { user } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });

    const session = await logIn(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });
    expect(session).toEqual({ userId: user.id, tokenVersion: 0 });
  });

  it("logs in with differently-cased email", async () => {
    await seedPlans();
    await signUp(tdb.db, { email: "casey@example.com", password: "hunter2hunter2" });
    await expect(
      logIn(tdb.db, { email: "CASEY@EXAMPLE.COM", password: "hunter2hunter2" }),
    ).resolves.toBeDefined();
  });

  it("rejects a wrong password", async () => {
    await seedPlans();
    await signUp(tdb.db, { email: "casey@example.com", password: "hunter2hunter2" });
    await expect(
      logIn(tdb.db, { email: "casey@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
  });

  // Same error for unknown email and wrong password, so the response cannot be
  // used to enumerate which addresses have accounts.
  it("gives the same error for an unknown email", async () => {
    await expect(
      logIn(tdb.db, { email: "nobody@example.com", password: "whatever" }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });

    await expect(
      logIn(tdb.db, { email: "nobody@example.com", password: "whatever" }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});

describe("getUserForSession", () => {
  it("resolves a valid session to the user", async () => {
    await seedPlans();
    const { user } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });

    const found = await getUserForSession(tdb.db, {
      userId: user.id,
      tokenVersion: 0,
    });
    expect(found?.id).toBe(user.id);
  });

  // This is the entire logout-everywhere mechanism.
  it("rejects a session whose token_version is stale", async () => {
    await seedPlans();
    const { user } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });
    const session = { userId: user.id, tokenVersion: 0 };

    expect(await getUserForSession(tdb.db, session)).not.toBeNull();

    await revokeAllSessions(tdb.db, user.id);

    expect(await getUserForSession(tdb.db, session)).toBeNull();
  });

  it("returns null for a deleted user", async () => {
    await seedPlans();
    const { user } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });
    await tdb.db.delete(users).where(eq(users.id, user.id));

    expect(
      await getUserForSession(tdb.db, { userId: user.id, tokenVersion: 0 }),
    ).toBeNull();
  });

  it("returns null for no session", async () => {
    expect(await getUserForSession(tdb.db, null)).toBeNull();
  });
});

describe("verifyEmail", () => {
  it("sets email_verified_at and consumes the token", async () => {
    await seedPlans();
    const { user, verificationToken } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });

    await verifyEmail(tdb.db, verificationToken);

    const [row] = await tdb.db.select().from(users).where(eq(users.id, user.id));
    expect(row.emailVerifiedAt).not.toBeNull();

    const [token] = await tdb.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    expect(token.consumedAt).not.toBeNull();
  });

  it("rejects a reused link", async () => {
    await seedPlans();
    const { verificationToken } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });

    await verifyEmail(tdb.db, verificationToken);
    await expect(verifyEmail(tdb.db, verificationToken)).rejects.toMatchObject({
      code: "invalid_token",
    });
  });

  it("rejects an expired link", async () => {
    await seedPlans();
    const { user, verificationToken } = await signUp(tdb.db, {
      email: "casey@example.com",
      password: "hunter2hunter2",
    });

    await tdb.db
      .update(emailVerificationTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailVerificationTokens.userId, user.id));

    await expect(verifyEmail(tdb.db, verificationToken)).rejects.toMatchObject({
      code: "invalid_token",
    });
  });

  it("rejects a token that was never issued", async () => {
    await expect(verifyEmail(tdb.db, "made-up-token")).rejects.toMatchObject({
      code: "invalid_token",
    });
  });
});
