import { createDatabase, createPool } from "./client";
import { plans } from "./schema";

/**
 * Seeds the plan table.
 *
 * Plans live in the database rather than in code so limits can be adjusted
 * without a deploy (data-model.md). Nothing works without these rows: every
 * subscription has a foreign key to `plans.code`, and signup creates one.
 *
 * Values come from ADR-0004. Daily caps are the abuse guard and apply to paid
 * plans too — a leaked Power account is $40/day of our money.
 */
export const PLAN_SEED = [
  {
    code: "trial",
    name: "Trial",
    priceCents: 0,
    generationLimit: 2,
    // Lifetime, not monthly — this is what makes it a trial rather than a
    // recurring free tier.
    period: "lifetime" as const,
    dailyCap: 2,
    stripePriceId: null,
  },
  {
    code: "pro",
    name: "Pro",
    priceCents: 2500,
    generationLimit: 25,
    period: "month" as const,
    dailyCap: 10,
    stripePriceId: null,
  },
  {
    code: "power",
    name: "Power",
    priceCents: 4500,
    generationLimit: 100,
    period: "month" as const,
    dailyCap: 20,
    stripePriceId: null,
  },
];

export async function seedPlans(db: ReturnType<typeof createDatabase>) {
  await db
    .insert(plans)
    .values(PLAN_SEED)
    .onConflictDoUpdate({
      target: plans.code,
      set: {
        name: plans.name,
        priceCents: plans.priceCents,
        generationLimit: plans.generationLimit,
        period: plans.period,
        dailyCap: plans.dailyCap,
      },
    });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = createPool(url);
  try {
    await seedPlans(createDatabase(pool));
    console.info(`seeded ${PLAN_SEED.length} plans`);
  } finally {
    await pool.end();
  }
}

// Only run when invoked directly, so importing PLAN_SEED in tests is free.
if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
