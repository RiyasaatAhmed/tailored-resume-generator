# Project context index

<!--
  TIER 4 — never auto-loaded. Costs nothing until an agent reads it.
  This file is the map: one line per file, saying which question it answers.
  If it isn't listed here, agents won't find it.
-->

## Foundations

- [product.md](product.md) — what we're building, for whom, what success looks like
- [tech.md](tech.md) — stack, versions, constraints, options considered and rejected
- [structure.md](structure.md) — file layout, naming, module boundaries

## Decisions

ADRs in MADR format. Start from [`0000-template.md`](decisions/0000-template.md).

- [0001](decisions/0001-generation-pipeline.md) — why the tailoring workflow is a
  deterministic API pipeline, not a ported agent
- [0002](decisions/0002-profile-sources.md) — why the profile has both structured
  fields and a persistent uploaded resume, and which wins on conflict
- [0003](decisions/0003-hosting-and-jobs.md) — why not Vercel serverless, and how
  generation jobs run
- [0004](decisions/0004-pricing-and-quota.md) — plan structure, unit economics,
  and the reserve-then-settle credit meter

## Specs

- [specs/](specs/) — one folder per feature: `spec.md` → `plan.md` → `tasks.md`

## Reference

- [reference/source-workflow.md](reference/source-workflow.md) — the Claude Code
  command this product reimplements, plus sample data. **Read before touching
  prompts or the resume schema.**
