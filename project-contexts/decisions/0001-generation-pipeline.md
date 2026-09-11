# Rebuild the tailoring workflow as a deterministic API pipeline

- Status: accepted
- Date: 2026-09-11

## Context and problem statement

The product is a productization of `/generate-custom-resume`, a 425-line Claude
Code slash command. That command cannot be invoked from a web application: it
assumes a local filesystem, hardcoded home-directory paths, five Python export
scripts, headless-Chrome screenshotting, and human-in-the-loop chat gates between
four phases.

The workflow has to be rebuilt server-side. The question is what shape.

## Decision drivers

- Predictable cost and latency per generation (this is a paid product surface).
- Each phase must be independently testable and debuggable.
- No arbitrary code execution per user request in v1.
- The company-research phase genuinely needs live web access.

## Considered options

1. Deterministic pipeline of discrete Messages API calls.
2. Claude Agent SDK — Claude Code as a hosted library.
3. Managed Agents — Anthropic runs the loop and a per-session sandbox.

## Decision

Chose **option 1**, a deterministic pipeline:

1. **Research** — one `claude-opus-5` call with the `web_search_20260209` server
   tool, structured output → Company Intelligence brief. Server-side; no agent
   loop to write.
2. **Rewrite** — one `claude-opus-5` call taking the brief, the job post, and the
   user's sources. Structured output → resume JSON.
3. **Render** — resume JSON into an HTML template, Playwright → PDF.

The source command remains the **specification** for prompt content — Phase 1
Step 5's rewrite rules, the gap-type taxonomy, the quality checklist — without
being a runtime dependency.

## Consequences

- Good: two API calls, bounded cost, each phase a debuggable artifact.
- Good: the shared rewrite rules become a cached system prompt across all users.
- Good: no sandbox to operate.
- Bad: loses the agent's ability to adapt mid-run (e.g. researching a recruiter
  when the real employer is anonymous). Handle in prompt, or accept degraded
  output for anonymous postings.
- Bad: the phase gates from the original become our orchestration code, so their
  invariants must be re-asserted in tests rather than in prose.

## Rejected options

**Claude Agent SDK.** Closest 1:1 port and the least prompt-porting work, but it
runs an agentic loop with bash and filesystem tools per user request. That is a
sandboxing and cost-control problem we do not need to own to ship. Revisit if the
fixed pipeline proves too rigid for edge-case postings.

**Managed Agents.** Anthropic hosts both the loop and a per-session container,
which fits the original's multi-phase shape well and would let us run the export
step in-container. Rejected as overkill for what is currently two API calls — but
this is the right destination if the pipeline later needs per-user code
execution.
