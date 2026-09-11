# Source workflow and sample data

The workflow this product reimplements, plus the fixtures it was developed
against. Read this before working on prompts, the resume schema, or the
renderer.

## The workflow being productized

[`source-command.md`](source-command.md) — a frozen verbatim copy of
`~/.claude/commands/generate-custom-resume.md`, the Claude Code slash command
this product reimplements. **Not a runtime dependency** (see
[ADR-0001](../decisions/0001-generation-pipeline.md)); it is the prompt and
quality specification.

It is vendored here deliberately. The specification of record has to live in the
repo that implements it — agents, CI, and future collaborators cannot read one
person's home directory. Edit the upstream file, then re-vendor; do not edit the
copy in place.

Most load-bearing sections:

| Section | Why it matters here |
|---|---|
| Phase 1 Step 2 | Company Intelligence brief — the exact fields the research call must return |
| Phase 1 Step 3 | Job-post parsing buckets, including "hidden problem" |
| Phase 1 Step 4 | Gap-analysis table and the gap-type taxonomy |
| Phase 1 Step 5 | **The rewrite rules.** Ports into the cached system prompt — but see "What to strip" below |
| Deliverable | Quality checklist — the basis for output validation tests |

Phases 3 (cover letter) and 4 (interview prep) are out of scope for MVP.

## What to strip when porting

The command was written for one person on one machine. Several rules inside the
otherwise-shared sections are **candidate-specific** and cannot go into a
multi-tenant cached prompt. Line numbers are for the original; add 32 for the
vendored copy.

| Original lines | What it is | Why it can't ship as-is |
|---|---|---|
| 116–119 | Health-tech rules naming Martlet.ai, RADV, HCC, RAF, ICD-10 | One user's domain. Drop it, or generalize into a per-profile domain specialization — which then belongs *after* the cache breakpoint, not in the shared prefix |
| 124 | The candidate's standard headline and the LinkedIn-consistency note | One user's headline |
| 111 | `constants/experiences/` as a provenance source | Replace with "the user's profile and active source documents" |
| 150 | `[View Project]` exporter behavior | Renderer concern; already modeled as `link_label` / `link_url` in the data model |
| 158–164 | Chrome screenshot wrap-check | Replaced by the HTML template enforcing one line per bullet (see `tech.md`) |

**This matters for caching, not just correctness.** Prompt caching is a prefix
match rendered `tools` → `system` → `messages`; one changed byte invalidates
everything after it. The stripped, genuinely user-agnostic rules plus the output
schema go in `system` with the cache breakpoint on the last block. The company
brief, job post, profile, and source documents go in `messages`, after it.
Anything user- or job-specific placed before the breakpoint means the cache
never hits.

## What NOT to port

`~/Desktop/portfolio/.cursor/skills/resume-md-export/scripts/` — the Python
export pipeline (docx templates, PDF, Chrome screenshot wrap-checking). Built
for one local machine; replaced by an HTML template rendered through Playwright.
Listed here so nobody rediscovers it and assumes it's the intended path.

## Sample source data

Still outside the repo. Both are the owner's real resume — full name, email,
phone, employment history — so they need a redaction decision before they land
in git. Vendor them into `fixtures/` (not here) when the test suite exists.

`~/Desktop/portfolio/resume/base-frontend.md` — a realistic example of a
well-populated profile: quantified bullets, per-role bullet banks in HTML
comments, grouped skills. Useful as a fixture and as the quality bar for what
"good input" looks like.

`~/Desktop/portfolio/resume/tailored/` — generated outputs from the existing
workflow, with archived job posts. Good regression fixtures.
