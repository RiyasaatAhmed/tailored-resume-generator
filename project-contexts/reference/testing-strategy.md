# Testing strategy

<!--
  What to test, at which layer, and what to deliberately leave untested.
  Written before the app is scaffolded, so it is a plan — but the obligations
  it collects are already committed to elsewhere and were homeless until now.
-->

Three things in this product break in ways type-checking cannot catch: **the
credit meter leaks money**, **the LLM invents facts**, and **a bullet wraps to a
second line**. Each is a stated promise — to the margin, to the user, and in
`product.md`'s success criteria. This document exists so those three get real
coverage before anything else does.

## Obligations already on record

These were levied across five documents with no plan to satisfy them. Collected
here so they stop being prose:

| Source | Obligation |
|---|---|
| [ADR-0001](../decisions/0001-generation-pipeline.md):19 | Each pipeline phase must be independently testable |
| [ADR-0001](../decisions/0001-generation-pipeline.md):53 | The original's phase gates became orchestration code — "their invariants must be re-asserted in tests rather than in prose" |
| [ADR-0004](../decisions/0004-pricing-and-quota.md):72 | "The release path needs test coverage or failed jobs silently burn credits" |
| [data-model.md](data-model.md):331 | Sweeper for stuck reservations needs coverage on the release path |
| [data-model.md](data-model.md):443 | Seven named invariants |
| [source-workflow.md](source-workflow.md):28 | The source command's Deliverable checklist is "the basis for output validation tests" |
| [source-workflow.md](source-workflow.md):66 | Sample data gets vendored into `fixtures/` "when the test suite exists" |
| [resume-template.md](resume-template.md):204 | Invariant #6 is enforceable as a DOM assertion in the render step |

## Tooling

| Layer | Choice | Why |
|---|---|---|
| Runner | **Vitest** | Same esbuild/TS pipeline as Next.js; no separate Babel config |
| DB under test | **Testcontainers** (`postgres:17-alpine`) | See below — PGlite cannot test the thing that matters most |
| HTTP boundary | **MSW** | Intercepts Anthropic and Stripe at the network layer, not the module layer |
| Route handlers | **`next-test-api-route-handler`** | Exercises the real handler with real `Request`/`Response` |
| Browser / PDF | **Playwright** | Already a runtime dependency; no second browser stack |
| PDF assertions | **`pdf-parse`** for text, **`pixelmatch`** for visual | Text catches semantic regressions; pixels catch layout |

**Testcontainers, not PGlite — and this is not a preference.** PGlite is real
Postgres compiled to WASM and is genuinely faster, but it is
**single-connection**. The single most valuable test in this suite is two
concurrent transactions racing for the last credit
([ADR-0004](../decisions/0004-pricing-and-quota.md)'s double-spend scenario),
which cannot be expressed without two real connections. `pg-boss` also leans on
`SKIP LOCKED` across concurrent workers. Use a real container.

Migrate the container with the actual Drizzle migrations rather than pushing the
schema — that is the only way migrations themselves get tested. The container
needs `pgcrypto` (for `gen_random_uuid()`) and `citext` enabled.

---

## Layer 1 — Pure logic, no I/O

Fast, plentiful, and boring. These are the functions where a subtle bug is
invisible in review:

- **`company_domain` normalization** — lowercase, strip `www.`, strip protocol
  and path. This is a *global* cache key; a normalization bug serves one
  company's brief to another. Table-driven test with the ugly cases:
  `https://WWW.Acme.co.uk/careers` → `acme.co.uk`.
- **`content_hash`** — normalize whitespace before hashing, so re-pasting the
  same posting with different line endings hits the existing row.
- **Quota arithmetic** — given a set of reservations and a period, how many
  remain. Pure function, exhaustively testable, decides whether users get
  billed correctly.
- **Bullet character counting** — must count rendered characters, not raw
  string length. `**bold**` markers are markup, not glyphs; a naive
  `.length` over-counts by four per bold span and silently narrows the
  authoring range.
- **Date formatting** — `end_date: null` → "Present", `YYYY-MM` → display form.

## Layer 2 — The meter, against real Postgres

**Write these first.** Not because they are hardest, but because this is the
only subsystem where a bug costs money on every occurrence and is invisible
until the bill arrives.

| Test | Asserts |
|---|---|
| Two concurrent `POST /api/generations` with one credit left | Exactly one succeeds, one gets 402. The `FOR UPDATE` lock on `subscriptions` actually serializes |
| Generation fails mid-run | Reservation ends `released`; quota is restored |
| Generation succeeds | Reservation ends `committed` |
| Worker crashes, leaving `reserved` | The sweeper releases it after N minutes |
| `released` rows exist in the period | They do **not** count against quota |
| Daily cap reached on a paid plan | 429, and no reservation row is created |
| Reservation fails | **No job is enqueued** — the transaction rolled back before `pg-boss` was touched |
| Trial user, 2 lifetime used | Third attempt is refused regardless of elapsed time |

The last two are the ones that get skipped and shouldn't. "Enqueued without a
reservation" is invariant #1 and is the exact failure that hands out free
generations.

**Stripe webhooks belong here too**, since entitlement is the same surface:

- Replaying the same `event_id` five times produces **one** state change — the
  unique violation on insert is the dedupe, not an `if (exists)` check.
- A webhook with a bad signature is rejected before any business logic runs.
- A checkout success redirect **grants nothing** — only the webhook does.
  Assert this explicitly; it is the difference between a paid product and a
  free one.
- `past_due` → generation refused; `canceled` → generation refused; downgrade
  → historical generations still readable (per the data model's retention rule).

Use recorded real event payloads as fixtures, not hand-written ones. Stripe's
event shape has fields you will not think to include.

## Layer 3 — Pipeline phases in isolation

ADR-0001 promised each phase is independently testable. That promise is only
real if the phases are pure functions over their inputs:

```
research:  job_post            → company brief JSON
rewrite:   brief + job + sources → resume_json
render:    resume_json         → HTML → PDF
```

Test each with the previous phase's output as a **recorded fixture**. No test
in CI may call the Anthropic API — at ~$0.40 a run, a test suite that hits the
real model is a budget line item and a flake source.

What to assert per phase:

**Research** — output validates against the brief schema; unresearchable fields
land in `unknown_fields` rather than being invented; **an anonymous posting
never reads from or writes to `company_briefs`** (invariant #4, and the one that
poisons the global cache for every user if it regresses).

**Rewrite** — output validates against `resume_json`; ≤4 bullets per role;
bullets carry 2–4 bold spans; `in_bank` bullets appear only when deliberately
selected; skills are concrete tools, never categories.

**Render** — see Layer 5.

**Prompt cache integrity deserves its own test.** `source-workflow.md` is
explicit that caching is a prefix match and one changed byte invalidates
everything after it. Assert that the assembled system prompt contains no
user-specific or job-specific string — take a fixture user, render the prompt,
and assert their name, email, company, and job title appear nowhere before the
cache breakpoint. A cache miss is silent and roughly triples the cost of the
rewrite call; nothing else will tell you.

## Layer 4 — LLM output quality (evals, not unit tests)

This is where most projects either skip testing or write assertions that flake.
The resolution from current practice is to **stop asserting equality and start
asserting properties**. Same prompt, different output, every time — so
`expect(output).toEqual(golden)` is unwriteable.

Split it in two:

**Contract assertions — run in CI, against recorded fixtures.** Deterministic
because the model response is replayed, not generated:

- Valid JSON, schema satisfied
- Bullet count, character range, bold-span count
- **Every metric in the output appears in the input profile or source
  document** — invariant #5, and the machine-checkable half of the
  no-invention promise. Extract every number from `resume_json`, extract every
  number from the inputs, assert subset. This is the single highest-value
  assertion in the suite, because "never invents" is the product.
- `change_log.metric_sources` accounts for every bolded metric

**Evals — run on demand, never gating a merge.** These call the real model
across a fixture set of ~20 (job post, profile) pairs and score properties:
must-have phrases copied verbatim, no banned AI vocabulary (the source command
ships the grep for it — `delve|leverage|spearhead|testament|tapestry|robust|
seamless|passionate|excited|thrilled|synergy|results-driven`), gap report
surfaces real gaps rather than papering over them. Run each case 3–5 times and
require most to pass, since a single sample proves nothing about a
non-deterministic system. Track the score over time; a prompt change that drops
it is a regression even when every unit test is green.

Keep evals out of the merge gate. They cost money, they are slow, and a flaky
required check trains people to ignore failures.

## Layer 5 — The rendered document

`resume-template.md` already did the hard research here; this just makes it
executable.

- **Wrap check under print emulation.** Viewport `678px` (A4 content width at
  96 dpi), `emulateMedia({ media: 'print' })`, then
  `round(el.getBoundingClientRect().height / lineHeight) > 1` on every bullet.
  Measuring on a default 1280px viewport is a **false pass** — nothing wraps at
  that width. This is invariant #6 and a stated success criterion.
- **`format: 'A4'` is asserted, not assumed.** Playwright ignores
  `@page { size: A4 }` and silently emits US Letter, which is wider — so
  over-long bullets pass. Assert the emitted page dimensions.
- **Text extraction over byte comparison.** The Chrome-headless/Playwright
  parity check found a 0.96pt page-size drift from A4 rounding, so a byte-level
  PDF diff will never be clean. Compare extracted text and link-annotation
  count instead.
- **`break-inside: avoid`** actually keeps a role off a page boundary.
- A profile with no honors, no education, or a single role still renders — the
  empty-section cases nobody builds fixtures for.

## Layer 6 — End-to-end, kept deliberately thin

One path, with the model mocked: sign up → verify email → populate profile →
paste a job post → generation completes → PDF downloads. Its job is to prove the
wiring holds, not to test behavior that lower layers already cover.

Add a second for the gate that protects the trial:
`email_verified_at IS NULL` → generation refused (invariant #3).

---

## Never mock / always mock

**Never mock:** Postgres, Drizzle's query builder, or the credit reservation
transaction. The type system already handles compile-time shape; the whole risk
is in SQL semantics — lock behavior, cascade deletes, unique violations — and a
mock asserts only that you called the function you wrote.

**Always mock in CI:** the Anthropic API (cost, latency, non-determinism),
Stripe's network calls (use recorded payloads, and `stripe listen`/`stripe
trigger` for local manual checks), object storage, and outbound email.

## Fixtures — one blocker to clear first

`source-workflow.md` names the fixture source: `base-frontend.md` (a
well-populated profile) and `resume/tailored/` (generated outputs with archived
job posts, explicitly "good regression fixtures").

**Both are the owner's real resume** — full name, email, phone, address,
employment history. They cannot land in git as-is, and the doc already flags the
redaction decision as outstanding. Resolve it before writing Layer 3 or 4, since
those layers are unbuildable without fixtures. Redact to a consistent fake
identity rather than stripping fields; the shape of a real, dense resume is
exactly what makes the fixture valuable.

## What gates a merge

| Runs | On what |
|---|---|
| Typecheck, lint, Layers 1–3, 5 | Every push — fast, deterministic, no network |
| Layer 6 E2E | Every push to `main` |
| Layer 4 evals | On demand and before a prompt change ships |
| Real-model smoke (one generation) | Before deploy, against staging |

## Deliberate non-goals

- **No coverage percentage target.** Coverage measures executed lines, not
  asserted behavior, and a number turns into tests written to raise it. The
  seven invariants plus the meter table above are the bar. Use
  `constraint-driven-development` if a number is wanted anyway.
- **No snapshot tests of LLM output.** They encode one sample of a
  non-deterministic process, then get blessed on every diff until they assert
  nothing.
- **No unit tests for Drizzle-generated queries or Next.js framework behavior.**
  Test your logic, not your dependencies.
- **No pixel-diffing the whole PDF in CI.** Font rendering drifts across
  platforms and the suite becomes a source of noise. Keep visual diffs manual
  and local, and let text extraction plus the wrap check carry CI.

## Invariant coverage map

Each of the seven invariants in [data-model.md](data-model.md), plus the two
product-level promises, mapped to the layer that proves it:

| # | Invariant | Layer |
|---|---|---|
| 1 | No generation enqueued without a committed reservation | 2 |
| 2 | Failed/canceled generation always releases its reservation | 2 |
| 3 | `email_verified_at` non-NULL before first generation | 2, 6 |
| 4 | Anonymous job posts never touch `company_briefs` | 3 |
| 5 | Every metric traces to user input | 4 (contract) |
| 6 | No bullet wraps to a second line | 5 |
| 7 | Profile beats `source_documents.content_md` on conflict | 3 |
| — | Tailored PDF in under 3 minutes | 6, timed |
| — | Prompt cache actually hits | 3 |
