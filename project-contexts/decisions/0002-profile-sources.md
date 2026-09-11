# Profile is structured fields plus a persistent uploaded resume

- Status: accepted
- Date: 2026-09-11

## Context and problem statement

Generation quality depends on rich source material: quantified bullets, real
scope, verified wins. A structured-form-only profile has a punishing empty state
(30+ minutes before a user sees any output). A parse-the-upload-and-discard-it
approach loses material the user never re-types.

## Decision drivers

- Time from signup to first generated resume.
- Maximizing available source material at rewrite time.
- The no-invention rule means more real material directly improves output.
- Re-sending a PDF on every generation is wasteful and uncacheable.

## Decision

The profile has **two persistent inputs, both fed to generation**:

1. **Structured fields** — roles, bullets, skills, education, links. Editable,
   canonical, the thing the renderer reads for layout.
2. **Uploaded resume** — the user's existing file. Parsed **once at upload** into
   a canonical markdown *source document*, which is stored, shown to the user,
   and editable.

At generation time the rewrite call receives the structured profile **and** the
source document text. The original binary is retained for re-parsing, but is not
sent to the model on each generation.

This mirrors how the source command already works: `base-frontend.md` (structured)
plus bullet-bank comments plus docx variants are separate pools the rewrite
selects across.

## Consequences

- Good: fast onboarding — upload gets a user most of the way in ~2 minutes.
- Good: the source document can hold bullets the user chose not to surface in the
  structured profile, exactly like the bullet bank.
- Good: parsing once keeps per-generation cost and latency down and keeps the
  prompt prefix cacheable.
- Bad: two sources can disagree. **Precedence: structured profile wins for
  anything it defines** (dates, titles, employers, the bullets it lists); the
  source document is additional selectable material, never an override.
- Bad: parse quality becomes a support surface. Showing the extracted markdown
  and letting users fix it is the mitigation.

## Rejected options

**Structured form only.** Much less to build and no parse failures, but a
30-minute wall before any value. This is where the funnel dies.

**Upload only, no structured fields.** Nothing reliable for the renderer to lay
out, no clean schema to attach the future bullet-strengthening interview to.

**Parse on upload, then discard the file.** Loses re-parse ability when the parser
improves, and discards material the user never re-enters manually.

**Send the PDF on every generation.** Opus 5 accepts PDFs natively, so this would
work — but it pays image/document tokens on every run and makes the prompt prefix
vary per user in a way that hurts caching.
