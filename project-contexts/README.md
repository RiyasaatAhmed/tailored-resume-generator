# Project context index

<!--
  TIER 4 — never auto-loaded. Costs nothing until an agent reads it.
  This file is the map: one line per file, saying which question it answers.
  If it isn't listed here, agents won't find it.
-->

## Foundations

- [product.md](product.md) — what we're building, for whom, pricing, what's out
  of scope
- [tech.md](tech.md) — stack, hard constraints, and what was rejected and why

## Decisions

ADRs in MADR format. Copy [`0000-template.md`](decisions/0000-template.md) to start.

- [0001](decisions/0001-generation-pipeline.md) — why the tailoring workflow is a
  deterministic API pipeline, not a ported agent
- [0002](decisions/0002-profile-sources.md) — why the profile has both structured
  fields and a persistent uploaded resume, and which wins on conflict
- [0003](decisions/0003-hosting-and-jobs.md) — why not Vercel serverless, and how
  generation jobs run
- [0004](decisions/0004-pricing-and-quota.md) — plan structure, unit economics,
  and the reserve-then-settle credit meter

## Reference

- [reference/design-system.md](reference/design-system.md) — visual language:
  color and type tokens, component specs, do's and don'ts. Derived from an
  analysis of bugatti.com (via getdesign.md). Black canvas, no light mode, a
  three-family type trinity, and no accent color. **Read before building any
  UI.** Tokens move into code once the app is scaffolded — see the note at the
  top, which also covers what stands in for the photography this product
  doesn't have.
- [reference/resume-template.md](reference/resume-template.md) — the visual spec
  for the **generated PDF**: page geometry, type scale, and the measure the
  "90–105 characters per bullet" rule is derived from. Distinct from the design
  system, which covers the app. **Read before building the renderer or changing
  any bullet-length rule.**
- [reference/data-model.md](reference/data-model.md) — entities, columns, JSON
  payload shapes, and the invariants the schema alone doesn't express. **Read
  before writing migrations or changing the rewrite output schema.**
- [reference/testing-strategy.md](reference/testing-strategy.md) — what to test,
  at which layer, and what to leave untested. Collects the testing obligations
  the ADRs and the data model levied with nowhere to record them. **Read before
  writing the first test or setting up CI.**
- [reference/source-workflow.md](reference/source-workflow.md) — how to read the
  source command: which sections are load-bearing, which are candidate-specific
  and must be stripped, and what not to port at all. **Read before touching
  prompts or the resume schema** — and read it before `source-command.md`.
- [reference/source-command.md](reference/source-command.md) — frozen verbatim
  copy of the Claude Code command this product reimplements. The prompt and
  quality specification, not a dependency. Do not edit; re-vendor from
  `~/.claude/commands/` instead.
