# Product

<!-- What this is and who it's for. No implementation detail — that's tech.md. -->

## Problem

Generic resumes lose to ATS filters and to recruiters skimming for their own
vocabulary. Tailoring properly per application means researching the company,
mapping your real wins onto their stated problems, and rewriting every bullet in
their language. Done well it takes an hour per role, so almost nobody does it.

This productizes a workflow that already exists and works: the owner's
`/generate-custom-resume` Claude Code command (`~/.claude/commands/`).

## Users

**Primary:** experienced individual contributors (initially software engineers)
applying to a handful of roles a week, who already have a resume with real
accomplishments and need it re-aimed per application.

**Explicitly not the target for v1:** new grads and career changers. The output
quality is bounded by the quality of the source material, and users without
quantified accomplishments will get mediocre results. See "Quality depends on
input" below.

## Core flows

1. **Sign up** — email + password.
2. **Build profile** — structured fields (roles, bullets, skills, education)
   *and* an uploaded resume file. Both persist; both feed generation.
3. **Generate** — paste a job URL or job text. System researches the company,
   analyzes gaps, rewrites, and returns a tailored PDF.
4. **Review and iterate** — user sees the company brief, the gap report, and the
   change log alongside the PDF, then regenerates if needed.

## What makes it different

Most AI resume tools reword bullets. This one:

- **Researches the company first** and positions against their stated mission,
  values, vocabulary, and recent launches.
- **Never invents.** Every claim traces to the user's profile, their uploaded
  resume, or something they confirmed. Real gaps are surfaced, not papered over.
- **Copies must-have phrases verbatim** because many ATS filters match literally.
- **Enforces one line per bullet** in the rendered PDF, with metrics bolded.

These four are the product. Losing any of them makes it another rewording tool.

## Quality depends on input

The engine's output is bounded by the source material. "Reduced load times" cannot
become a strong bullet without a number, and the no-invention rule means it will
not manufacture one. Users with vague resumes will get vague output and will
blame the product.

Mitigation deferred past MVP: an onboarding interview that strengthens weak
bullets ("by how much? measured how?"). Design the profile schema so this can be
added without migration.

## Pricing

Generation costs real money (~$0.40 per run — see
[ADR-0004](decisions/0004-pricing-and-quota.md)), so the plan structure is
constrained by unit economics, not just positioning.

| Plan | Price | Generations | Notes |
|---|---|---|---|
| Trial | free | **2 lifetime** | Full quality. No card. Email verification required first. |
| Pro | $25/mo | 25 / month | The core product. |
| Power | $45/mo | 100 / month | Cover letters land here when they ship. |

**Everyone gets the same model and the same output quality.** The upgrade axes
are volume and features, never model tier. A deliberately degraded free output
teaches users the product doesn't work — it drives churn, not conversion.

There is no recurring free allowance. Job seekers churn naturally once hired, so
a monthly free tier subsidizes a population that is leaving anyway. One tailored
resume beside their old one is enough to prove the value.

Never advertise "unlimited." The cap is what keeps the margin floor above 50%
when a user maxes their plan.

## Success criteria

- A user with a populated profile gets a tailored PDF in under 3 minutes.
- Time from signup to first generated resume is under 10 minutes.
- Generated bullets are traceable — every metric appears in the user's own source
  material.
- No bullet wraps to a second line in the rendered PDF.

## Out of scope for MVP

- Cover letters (Phase 3 of the source command) — the obvious v2.
- `.docx` export. PDF only.
- Interview prep (Phase 4 of the source command).
- Application tracking / job board integration.
- Teams, sharing, collaboration.
- OAuth, SSO, password reset flows beyond the basics.
