import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The schema from `project-contexts/reference/data-model.md`.
 *
 * Conventions that file fixes and this one must not drift from:
 *   - uuid primary keys, `gen_random_uuid()` (needs pgcrypto)
 *   - timestamptz everywhere, always UTC
 *   - money as integer cents — never a float
 *   - Postgres enums, not free text
 *   - user-reorderable lists carry an integer `position`
 *   - deleting a user cascades to everything they own
 *   - resume dates are `date`; a null end date means "Present"
 */

/** Case-insensitive text, so casing cannot create duplicate accounts. */
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ---------------------------------------------------------------- Auth --- */

export const users = pgTable("users", {
  id: id(),
  email: citext("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** Gates the first generation (ADR-0004). */
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /**
   * The entire logout-everywhere mechanism: rides in the JWT claims and is
   * compared per request. Bumping it invalidates every outstanding token, which
   * is why there is no session table.
   */
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Verification tokens expire in 24h. Store the hash, never the token. */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** Kept after use — a reused link should say "already used", not "invalid". */
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Reset tokens expire in 1h. Otherwise identical. */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------- Profile --- */

/**
 * The structured source, and the canonical one: where this and an uploaded
 * source document disagree, this wins (ADR-0002).
 */
export const profiles = pgTable("profiles", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  /** Default headline; the rewrite overrides it per job. */
  headline: text("headline"),
  locationLine: text("location_line"),
  summary: text("summary"),
  /** `[{ label, url }]`, ordered. */
  contacts: jsonb("contacts").$type<{ label: string; url: string }[]>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const experiences = pgTable(
  "experiences",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    /**
     * One sentence describing the employer, rendered italic above the bullets.
     * Surfaced by resume-template.md as a gap in the original data model.
     */
    about: text("about"),
    startDate: date("start_date").notNull(),
    /** Null means Present. */
    endDate: date("end_date"),
    position: integer("position").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("experiences_profile_position_idx").on(t.profileId, t.position)],
);

export const experienceBullets = pgTable(
  "experience_bullets",
  {
    id: id(),
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    /** May contain `**bold**` markers — the only markup allowed. */
    text: text("text").notNull(),
    /**
     * The bullet bank: true, verified bullets kept off the default resume for
     * space. Not second-class or unverified — overflow inventory the rewrite
     * may select when a role calls for it. Never renders unless picked.
     */
    inBank: boolean("in_bank").notNull().default(false),
    /** Renders right-aligned on the company line, not inline in the bullet. */
    linkLabel: text("link_label"),
    linkUrl: text("link_url"),
    position: integer("position").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("experience_bullets_experience_position_idx").on(
      t.experienceId,
      t.position,
    ),
  ],
);

export const skillGroups = pgTable("skill_groups", {
  id: id(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/**
 * Rowed individually rather than a text array so the rewrite can reorder and
 * the gap analysis can match a posting's must-haves against specific entries.
 * Values must be concrete tools (`jest`), never categories (`testing`) —
 * enforced in UI copy and the rewrite prompt, not here.
 */
export const skills = pgTable("skills", {
  id: id(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => skillGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

export const education = pgTable("education", {
  id: id(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  institution: text("institution").notNull(),
  degree: text("degree").notNull(),
  field: text("field"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

export const honors = pgTable("honors", {
  id: id(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  issuer: text("issuer"),
  awardedOn: date("awarded_on"),
  position: integer("position").notNull(),
  createdAt: createdAt(),
});

/* ---------------------------------------------------- Source documents --- */

export const parseStatus = pgEnum("parse_status", [
  "pending",
  "parsing",
  "ready",
  "failed",
]);

/**
 * The second input from ADR-0002. Parsed once at upload; the parsed text, not
 * the binary, is what the rewrite call receives. The original is retained so
 * documents can be re-parsed when the parser improves.
 */
export const sourceDocuments = pgTable("source_documents", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  parseStatus: parseStatus("parse_status").notNull().default("pending"),
  parseError: text("parse_error"),
  /** Canonical parsed markdown. User-editable — the mitigation for bad parses. */
  contentMd: text("content_md"),
  /** Only active rows feed generation; several may be active at once. */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ---------------------------------------------------------- Generation --- */

/**
 * Archived because postings get taken down and are needed later for interview
 * prep.
 */
export const jobPosts = pgTable(
  "job_posts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Null when pasted rather than fetched. */
    sourceUrl: text("source_url"),
    rawText: text("raw_text").notNull(),
    /** sha256 of normalized rawText. */
    contentHash: text("content_hash").notNull(),
    /** The resolved employer, not the recruiter. */
    companyName: text("company_name"),
    /** Cache key into companyBriefs. Null when anonymous. */
    companyDomain: text("company_domain"),
    roleTitle: text("role_title"),
    /** Recruiter or stealth listing — skips the brief cache entirely. */
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    parsed: jsonb("parsed"),
    createdAt: createdAt(),
  },
  (t) => [
    // Re-pasting the same posting reuses the row rather than re-archiving it.
    unique("job_posts_user_content_hash_key").on(t.userId, t.contentHash),
  ],
);

/**
 * The cost cache — **global, not per-user**. A hit drops a generation from
 * ~$0.40 to ~$0.14 (ADR-0004). Never written for an anonymous posting: there is
 * no stable key, and caching a recruiter's brief under a made-up one would
 * poison results for everyone.
 */
export const companyBriefs = pgTable("company_briefs", {
  id: id(),
  /** Normalized lowercase, no `www.`. */
  domain: text("domain").notNull().unique(),
  companyName: text("company_name").notNull(),
  brief: jsonb("brief").notNull(),
  researchedAt: timestamp("researched_at", { withTimezone: true }).notNull(),
  /** researchedAt + 7 days. Expired rows are kept, not deleted. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/**
 * Doubles as the SSE progress feed — the client renders these phase names
 * directly, so renaming one means updating the UI copy with it.
 */
export const generationStatus = pgEnum("generation_status", [
  "queued",
  "researching",
  "analyzing",
  "rewriting",
  "rendering",
  "succeeded",
  "failed",
  "canceled",
]);

export const generations = pgTable(
  "generations",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "cascade" }),
    /** Null for anonymous postings. */
    companyBriefId: uuid("company_brief_id").references(() => companyBriefs.id, {
      onDelete: "set null",
    }),
    status: generationStatus("status").notNull().default("queued"),
    error: text("error"),
    resumeJson: jsonb("resume_json"),
    gapReport: jsonb("gap_report"),
    changeLog: jsonb("change_log"),
    pdfStorageKey: text("pdf_storage_key"),
    briefCacheHit: boolean("brief_cache_hit").notNull().default(false),
    model: text("model").notNull(),
    /**
     * Not optional. The ~$0.40 COGS figure behind every price point is an
     * unvalidated estimate; record usage from the first run so it can be
     * replaced with a measurement before pricing goes public.
     */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    costCents: integer("cost_cents"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("generations_user_created_idx").on(t.userId, t.createdAt)],
);

/* --------------------------------------------------- Billing and quota --- */

export const planPeriod = pgEnum("plan_period", ["lifetime", "month"]);

/**
 * Seeded, not user-editable. Kept in the database rather than in code so limits
 * can be adjusted without a deploy.
 */
export const plans = pgTable("plans", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  generationLimit: integer("generation_limit").notNull(),
  /** Trial is `lifetime` with limit 2 — that is what makes it a trial. */
  period: planPeriod("period").notNull(),
  /** Abuse guard. Applies to paid plans too. */
  dailyCap: integer("daily_cap").notNull(),
  stripePriceId: text("stripe_price_id"),
  /** Retire a plan without deleting it. */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

/**
 * One row per user, created at signup on the trial plan. **Stripe webhooks are
 * the source of truth for status and planCode** — never grant entitlement from
 * a checkout redirect, which a user can reach without the payment settling.
 */
export const subscriptions = pgTable("subscriptions", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  planCode: text("plan_code")
    .notNull()
    .references(() => plans.code),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: subscriptionStatus("status").notNull().default("trialing"),
  /** Null on the lifetime trial. */
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const reservationState = pgEnum("reservation_state", [
  "reserved",
  "committed",
  "released",
]);

/**
 * This table *is* the reserve-then-settle meter (ADR-0004).
 *
 * Quota consumed = rows in ('reserved','committed') within the current period.
 * `released` rows do not count — that is how a failed generation stops being
 * billed to the user.
 *
 * The reserve must be atomic, serialized by `SELECT ... FOR UPDATE` on the
 * user's `subscriptions` row. Do not lock this table: before the first insert
 * there is no row to lock.
 */
export const creditReservations = pgTable(
  "credit_reservations",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id")
      .unique()
      .references(() => generations.id, { onDelete: "cascade" }),
    state: reservationState("state").notNull().default("reserved"),
    /** Snapshotted at reserve time. Null for the lifetime trial. */
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    createdAt: createdAt(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    // Both quota counting and the daily cap scan by user over a time window.
    index("credit_reservations_user_created_idx").on(t.userId, t.createdAt),
    index("credit_reservations_user_state_idx").on(t.userId, t.state),
  ],
);

/**
 * Idempotency, not an audit log. Stripe retries webhooks; insert the id first
 * and let the unique violation tell you it is a duplicate.
 */
export const stripeEvents = pgTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: createdAt(),
});
