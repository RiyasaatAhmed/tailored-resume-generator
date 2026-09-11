# Source workflow and sample data

These live outside this repo. They are the specification the product is built
from — read them before working on prompts, the resume schema, or the renderer.

## The workflow being productized

`~/.claude/commands/generate-custom-resume.md` — the Claude Code slash command
this product reimplements. **Not a runtime dependency** (see
[ADR-0001](../decisions/0001-generation-pipeline.md)); it is the prompt and
quality specification.

Most load-bearing sections:

| Section | Why it matters here |
|---|---|
| Phase 1 Step 2 | Company Intelligence brief — the exact fields the research call must return |
| Phase 1 Step 3 | Job-post parsing buckets, including "hidden problem" |
| Phase 1 Step 4 | Gap-analysis table and the gap-type taxonomy |
| Phase 1 Step 5 | **The rewrite rules.** Ports directly into the cached system prompt |
| Deliverable | Quality checklist — the basis for output validation tests |

Phases 3 (cover letter) and 4 (interview prep) are out of scope for MVP.

## Sample source data

`~/Desktop/portfolio/resume/base-frontend.md` — a realistic example of a
well-populated profile: quantified bullets, per-role bullet banks in HTML
comments, grouped skills. Useful as a fixture and as the quality bar for what
"good input" looks like.

`~/Desktop/portfolio/resume/tailored/` — generated outputs from the existing
workflow, with archived job posts. Good regression fixtures.

## What NOT to port

`~/Desktop/portfolio/.cursor/skills/resume-md-export/scripts/` — the Python
export pipeline (docx templates, PDF, Chrome screenshot wrap-checking). Built for
one local machine; replaced by an HTML template rendered through Playwright.
Listed here so nobody rediscovers it and assumes it's the intended path.
