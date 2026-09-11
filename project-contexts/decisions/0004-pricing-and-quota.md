# Price on volume with a lifetime trial, metered by reserved credits

- Status: accepted
- Date: 2026-09-11

## Context and problem statement

A generation is not a cheap request. Two `claude-opus-5` calls, one of them
pulling several web pages into context, cost roughly **$0.40**:

| Step | Input | Output | Cost |
|---|---|---|---|
| Research (web_search pulls 4–6 pages in) | ~35K | ~3K | ~$0.25 |
| Rewrite (3K of rules cached at 0.1×) | ~10K | ~4K | ~$0.14 |

Plus ~$0.05 once per user to parse an uploaded resume. **These are estimates —
validate against real runs before committing to public price points.** The
research call's input size is the volatile part.

At that cost, the pricing structure is constrained by unit economics, and the
quota system has to be correct or it leaks money.

## Decision drivers

- Margin must survive a user who maxes their plan, not just the median user.
- Free-tier abuse is directly a cash cost, not just load.
- Job seekers churn by design — they get hired.
- Output quality is the entire product; degrading it to create upgrade pressure
  attacks the value proposition.

## Decision

**Price on volume and features. Never on model tier.** Every user gets
`claude-opus-5` and identical output quality.

| Plan | Price | Generations |
|---|---|---|
| Trial | free | 2 **lifetime** |
| Pro | $25/mo | 25 / month |
| Power | $45/mo | 100 / month |

**Metering: reserve on enqueue, settle on completion.**

1. `POST /api/generations` opens a transaction, atomically reserves one credit
   against the current period, and enqueues only if the reservation succeeds.
2. On success the reservation is committed.
3. On failure or cancellation the reservation is released — **a user is never
   charged for our error.**

The atomic reservation is what stops two browser tabs from double-spending a
final credit.

**A hard daily cap applies on every plan, including paid.** A shared or leaked
Power account is $40/day of our money. Set it well above legitimate use and alert
on breach.

**Email verification is required before the first generation.** Otherwise the
trial is a free, uncapped API endpoint.

## Consequences

- Good: margin floor is ~60% even when a Pro user exhausts their 25 runs;
  realistically ~85% at a median of 8–10.
- Good: no recurring cost from users who will never convert.
- Good: model choice becomes an internal cost lever, tunable without touching the
  pricing page or migrating customers on every model launch.
- Bad: a 2-generation trial is a narrow window to prove value. Onboarding and
  first-run quality carry unusual weight — a wasted trial run is a lost user.
- Bad: "25 generations" is a worse marketing line than "unlimited." Accepted;
  unlimited is not survivable at $0.40 marginal cost.
- Bad: reserve/settle is more moving parts than a simple counter, and the release
  path needs test coverage or failed jobs silently burn credits.

## Cost mitigation: cache company briefs

**Cache research briefs keyed by company domain with a ~7-day TTL.** A company's
mission, values, tone, and recent launches do not change week to week, and users
cluster heavily on the same employers.

A cache hit drops a generation from ~$0.40 to ~$0.14 by skipping the expensive
call entirely. At any user density this is a 30–50% COGS reduction for roughly a
day of work, and it makes repeat generations against the same company visibly
faster.

Build this before raising limits or discounting plans.

## Rejected options

**Model tier as the pricing axis** (free users get a cheap model, paying users get
the good one). Users buy interviews, not models. It forces them to become model
shoppers, rots the pricing page every time a model launches, and — worst — a
degraded free output teaches users the product doesn't work rather than making
them upgrade.

**Recurring monthly free tier** (e.g. 3/month). $1.35/user/month in perpetuity
from people who will never convert, aimed at a population that churns on success.

**Unlimited plans.** At $0.40 marginal cost there is no price that survives an
outlier.

**Pure credit packs with no subscription.** Simpler to reason about and matches
bursty job-search behavior, but gives up predictable MRR and makes the cover
letter upsell harder to position. Reconsider as an add-on for users who blow
through a monthly cap.

**Decrementing the quota at enqueue time without a release path.** Simplest
possible meter, but it charges users for our failures — the fastest way to earn
refund requests on a product that already costs money per run.
