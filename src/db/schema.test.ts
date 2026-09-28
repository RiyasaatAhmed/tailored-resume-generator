import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import {
  companyBriefs,
  creditReservations,
  experienceBullets,
  experiences,
  generations,
  jobPosts,
  plans,
  profiles,
  stripeEvents,
  subscriptions,
  users,
} from "./schema";
import { startTestDatabase, type TestDatabase } from "./testing/container";

/**
 * Layer 2 groundwork: the schema and migrations against a real Postgres.
 *
 * Requires a running Docker daemon. These are the tests that cannot be faked
 * with a mock — the whole risk is in SQL semantics.
 */
let tdb: TestDatabase;

beforeAll(async () => {
  tdb = await startTestDatabase();
}, 180_000);

afterAll(async () => {
  await tdb?.stop();
});

afterEach(async () => {
  await tdb.reset();
});

async function seedUser(email = "casey@example.com") {
  const [user] = await tdb.db
    .insert(users)
    .values({ email, passwordHash: "argon2-placeholder" })
    .returning();
  return user;
}

describe("migrations", () => {
  it("creates every table from the data model", async () => {
    const { rows } = await tdb.pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'`,
    );
    const names = rows.map((r) => r.tablename).sort();

    expect(names).toEqual(
      [
        "company_briefs",
        "credit_reservations",
        "education",
        "email_verification_tokens",
        "experience_bullets",
        "experiences",
        "generations",
        "honors",
        "job_posts",
        "password_reset_tokens",
        "plans",
        "profiles",
        "skill_groups",
        "skills",
        "source_documents",
        "stripe_events",
        "subscriptions",
        "users",
      ].sort(),
    );
  });

  it("enables citext, which users.email depends on", async () => {
    const { rows } = await tdb.pool.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'citext'`,
    );
    expect(rows).toHaveLength(1);
  });
});

describe("users", () => {
  // citext exists so casing cannot create two accounts for one person.
  it("treats email as case-insensitive for uniqueness", async () => {
    await seedUser("Casey@Example.com");
    await expect(seedUser("casey@example.com")).rejects.toThrow();
  });

  it("finds a user by differently-cased email", async () => {
    await seedUser("Casey@Example.com");
    const found = await tdb.db
      .select()
      .from(users)
      .where(eq(users.email, "CASEY@EXAMPLE.COM"));
    expect(found).toHaveLength(1);
  });

  it("defaults token_version to 0 and email_verified_at to null", async () => {
    const user = await seedUser();
    expect(user.tokenVersion).toBe(0);
    expect(user.emailVerifiedAt).toBeNull();
  });
});

describe("cascade deletes", () => {
  // "Deleting a user cascades to everything they own" (data-model.md).
  it("removes everything a user owns", async () => {
    const user = await seedUser();

    const [profile] = await tdb.db
      .insert(profiles)
      .values({ userId: user.id, fullName: "Casey Ray" })
      .returning();

    const [experience] = await tdb.db
      .insert(experiences)
      .values({
        profileId: profile.id,
        company: "Northwind",
        title: "Engineer",
        startDate: "2023-04-01",
        position: 0,
      })
      .returning();

    await tdb.db.insert(experienceBullets).values({
      experienceId: experience.id,
      text: "Cut latency by **48%**",
      position: 0,
    });

    await tdb.db.insert(jobPosts).values({
      userId: user.id,
      rawText: "We are hiring",
      contentHash: "hash-1",
    });

    await tdb.db.delete(users).where(eq(users.id, user.id));

    expect(await tdb.db.select().from(profiles)).toHaveLength(0);
    expect(await tdb.db.select().from(experiences)).toHaveLength(0);
    expect(await tdb.db.select().from(experienceBullets)).toHaveLength(0);
    expect(await tdb.db.select().from(jobPosts)).toHaveLength(0);
  });

  // The brief cache is global; one user leaving must not evict it.
  it("does not delete a global company brief when a user is deleted", async () => {
    const user = await seedUser();
    await tdb.db.insert(companyBriefs).values({
      domain: "acme.co.uk",
      companyName: "Acme",
      brief: { mission: "make things" },
      researchedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    await tdb.db.delete(users).where(eq(users.id, user.id));

    expect(await tdb.db.select().from(companyBriefs)).toHaveLength(1);
  });
});

describe("constraints", () => {
  // Re-pasting the same posting reuses the row rather than re-archiving it.
  it("rejects a duplicate (user_id, content_hash) job post", async () => {
    const user = await seedUser();
    const values = {
      userId: user.id,
      rawText: "We are hiring",
      contentHash: "hash-1",
    };
    await tdb.db.insert(jobPosts).values(values);
    await expect(tdb.db.insert(jobPosts).values(values)).rejects.toThrow();
  });

  it("allows two users to archive the same posting", async () => {
    const a = await seedUser("a@example.com");
    const b = await seedUser("b@example.com");
    await tdb.db
      .insert(jobPosts)
      .values({ userId: a.id, rawText: "x", contentHash: "same" });
    await tdb.db
      .insert(jobPosts)
      .values({ userId: b.id, rawText: "x", contentHash: "same" });
    expect(await tdb.db.select().from(jobPosts)).toHaveLength(2);
  });

  // Idempotency is the unique violation, not an existence check.
  it("rejects a replayed stripe event id", async () => {
    const event = {
      eventId: "evt_1",
      type: "customer.subscription.updated",
      payload: {},
    };
    await tdb.db.insert(stripeEvents).values(event);
    await expect(tdb.db.insert(stripeEvents).values(event)).rejects.toThrow();
  });

  it("rejects a value outside the reservation_state enum", async () => {
    const user = await seedUser();
    await expect(
      tdb.pool.query(
        `INSERT INTO credit_reservations (user_id, state) VALUES ($1, 'refunded')`,
        [user.id],
      ),
    ).rejects.toThrow();
  });

  it("requires a subscription to reference a real plan", async () => {
    const user = await seedUser();
    await expect(
      tdb.db
        .insert(subscriptions)
        .values({ userId: user.id, planCode: "enterprise" }),
    ).rejects.toThrow();
  });

  it("allows at most one reservation per generation", async () => {
    const user = await seedUser();
    const [post] = await tdb.db
      .insert(jobPosts)
      .values({ userId: user.id, rawText: "hiring", contentHash: "h" })
      .returning();
    const [generation] = await tdb.db
      .insert(generations)
      .values({ userId: user.id, jobPostId: post.id, model: "claude-opus-5" })
      .returning();

    await tdb.db.insert(creditReservations).values({
      userId: user.id,
      generationId: generation.id,
      state: "reserved",
    });

    await expect(
      tdb.db.insert(creditReservations).values({
        userId: user.id,
        generationId: generation.id,
        state: "reserved",
      }),
    ).rejects.toThrow();
  });

  it("allows many reservations with no generation yet, since the column is nullable", async () => {
    const user = await seedUser();
    await tdb.db
      .insert(creditReservations)
      .values({ userId: user.id, state: "reserved" });
    await tdb.db
      .insert(creditReservations)
      .values({ userId: user.id, state: "reserved" });
    expect(await tdb.db.select().from(creditReservations)).toHaveLength(2);
  });
});

describe("conventions", () => {
  it("stores timestamps as timestamptz", async () => {
    const { rows } = await tdb.pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'created_at'`,
    );
    expect(rows[0].data_type).toBe("timestamp with time zone");
  });

  // Money is integer cents — never a float, never numeric dollars.
  it("stores plan prices as integer cents", async () => {
    const { rows } = await tdb.pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'plans' AND column_name = 'price_cents'`,
    );
    expect(rows[0].data_type).toBe("integer");
  });

  it("stores resume dates as date, not timestamptz", async () => {
    const { rows } = await tdb.pool.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'experiences' AND column_name = 'start_date'`,
    );
    expect(rows[0].data_type).toBe("date");
  });

  it("seeds and reads the three plans with their real limits", async () => {
    await tdb.db.insert(plans).values([
      {
        code: "trial",
        name: "Trial",
        priceCents: 0,
        generationLimit: 2,
        period: "lifetime",
        dailyCap: 2,
      },
      {
        code: "pro",
        name: "Pro",
        priceCents: 2500,
        generationLimit: 25,
        period: "month",
        dailyCap: 10,
      },
      {
        code: "power",
        name: "Power",
        priceCents: 4500,
        generationLimit: 100,
        period: "month",
        dailyCap: 20,
      },
    ]);

    const rows = await tdb.db
      .select()
      .from(plans)
      .orderBy(sql`price_cents`);

    expect(rows.map((r) => r.code)).toEqual(["trial", "pro", "power"]);
    // Trial is lifetime with a limit of 2 — that is what makes it a trial
    // rather than a recurring free tier.
    expect(rows[0].period).toBe("lifetime");
    expect(rows[0].generationLimit).toBe(2);
  });
});
