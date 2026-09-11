# Tech

<!--
  Stack and constraints. The load-bearing section is "Rejected" — an agent
  cannot re-derive why you said no, and will keep re-proposing it otherwise.
-->

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router), TypeScript — one repo, one deploy |
| DB | PostgreSQL + Drizzle ORM |
| Auth | Hand-rolled: `argon2` password hashing, `jose` for JWT, httpOnly cookie |
| Jobs | `pg-boss` — Postgres-backed queue, no Redis |
| LLM | Anthropic Messages API, `claude-opus-5` |
| PDF | Playwright → Chromium, rendering an HTML resume template |
| Hosting | A Node-process host (Railway / Fly / Render), **not** Vercel serverless |

## Constraints

**Hosting is not a free choice.** Generation runs 60–120s and Playwright needs a
real Chromium binary. Vercel's serverless runtime fits neither. Either deploy the
whole app to a long-running Node host, or split the worker out — see
[ADR-0003](decisions/0003-hosting-and-jobs.md).

**Job URL fetching fails often.** LinkedIn and Indeed block server-side fetches.
Pasted job text is the primary input path; URL fetch is the convenience path with
a paste fallback. Do not build UI that assumes URL is the happy case.

**Generation is not request-scoped.** A POST enqueues a job and returns an id;
the client subscribes to an SSE endpoint for progress
(`researching` → `analyzing` → `rewriting` → `rendering`). Work must survive a
closed tab.

**Every generation spends real money before it produces anything** (~$0.40, and
the research call is most of it). Two consequences, both in
[ADR-0004](decisions/0004-pricing-and-quota.md): reserve a credit atomically
*before* enqueueing and release it on failure; and cache company briefs by domain
with a ~7-day TTL, which is the highest-leverage cost optimization available.

**The rewrite rules are a cached system prompt.** They are identical for every
user and every job (~200 lines, ported from Phase 1 Step 5 of the source
command). Put them under `cache_control` — Opus 5's cache minimum is 512 tokens,
so they qualify easily. Anything user- or job-specific goes *after* the
breakpoint or the cache never hits.

## External services

- **Anthropic API** — generation, company research (via the `web_search` server
  tool), and parsing uploaded resumes.
- **Object storage** — original uploaded resume files and generated PDFs.
  Provider not yet chosen.
- **Stripe** — subscriptions, checkout, and the customer portal. Webhooks are the
  source of truth for plan state; never infer entitlement from a checkout
  redirect.
- **Email** — verification (required before the first generation, see
  [ADR-0004](decisions/0004-pricing-and-quota.md)) and billing notices. Provider
  not yet chosen.

## Rejected alternatives

**Calling `/generate-custom-resume` directly.** It is not callable. It is a
Claude Code slash command that assumes a local filesystem, a specific home
directory, five Python export scripts, headless-Chrome screenshotting, and
human-in-the-loop chat gates. It is the *specification* for the pipeline, not a
dependency of it.

**Claude Agent SDK.** Would be the closest 1:1 port, but means running an agentic
loop with bash and filesystem access per user request — sandboxing burden,
unbounded cost, unbounded latency. Revisit if the deterministic pipeline proves
too rigid.

**Managed Agents.** Anthropic hosts the loop and a per-session sandbox, which
genuinely fits the multi-phase shape. Overkill for two API calls. The real
candidate if the pipeline later needs to run code per user.

**The Python export pipeline** (`md_export.py`, `md_to_docx.py`, docx templates,
Chrome screenshot wrap-checking). Built for one person's machine. Replaced by an
HTML template rendered through Playwright; the one-line-per-bullet rule is
enforced in the template, not by screenshotting and re-prompting.

**Auth.js / NextAuth.** Session-cookie oriented; awkward for a plain
credentials + JWT setup. Revisit when OAuth providers are added.

**Redis-backed queue (BullMQ).** A second piece of infrastructure for a workload
measured in jobs per minute. Postgres is already there.

**Downgrading the model to save cost.** Output quality is the entire product.
Cut scope, not model. Cache briefs and tighten quotas instead.

**Gemini's free tier for the MVP.** Considered and rejected on data handling, not
cost. On Google's free tier, submitted content is used to improve Google products
and *human reviewers may read API input and output*; Google explicitly says not to
send personal information to non-paid services. Our entire input is resumes —
name, email, phone, address, full employment history. This is a cannot-launch
issue, not a later hardening step. (Free-tier rate limits are also per *project*,
not per key: ~100 requests/day on Pro-class models would cap the whole product at
roughly 50 generations/day.) Fine for local development against your own resume;
never for user data. A multi-provider abstraction was dropped along with it — if
a second provider ever lands, the seam is at the pipeline *step* level, not a
generic LLM client, because the research step couples to server-side web search
far more tightly than the others.
