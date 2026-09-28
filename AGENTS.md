# tailored-resume-generator

<!--
  TIER 1 — loaded into EVERY session by every agent. Budget: <100 lines.
  Test for each line: "Would removing this cause the agent to make a mistake?"
  If no, cut it. Commands first, prose last.
  HTML comments like this one are stripped before reaching Claude's context.
-->

```bash
npm run dev         # Next.js dev server
npm run build       # production build
npm test            # vitest run (launches real Chromium for render tests)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run db:generate # drizzle-kit generate — after editing src/db/schema.ts
npm run db:migrate  # apply migrations to $DATABASE_URL
```

**`npm test` needs a running Docker daemon.** The database tests start a real
`postgres:17-alpine` via Testcontainers, because the tests that matter most —
two transactions racing for the last credit, `pg-boss` and SKIP LOCKED — need
concurrent connections that PGlite cannot give.

Built so far: the PDF renderer (`src/lib/resume/`) and the database schema
(`src/db/`). No auth, billing, or generation pipeline yet.

`drizzle/0000_init.sql` carries a hand-added `CREATE EXTENSION citext` that
drizzle-kit does not emit. Re-add it if that migration is ever regenerated.

`src/lib/resume/css.ts` is ported **verbatim** from the Python exporter. The
"one line per bullet, 90–105 characters" rule holds only at that exact
combination of page size, margins, font, and type size. Change a value there and
recompute the range — do not carry it across. `page.pdf()` must always pass
`format: 'A4'`; Playwright ignores `@page { size: A4 }` and silently emits US
Letter, which is wider and lets over-long bullets through.

## Next.js and React changes: check the official docs first

**Before deciding anything Next.js- or React-related, read the official
documentation and follow what it says.** This applies to routing, rendering
modes, caching, Server Components, Server Actions, route handlers, middleware,
config, hooks, and any API you are about to call.

Read in this order:

1. **`node_modules/next/dist/docs/`** — the docs for the exact version installed
   here. Prefer these: the website documents the current release, which may not
   be ours. See the auto-generated block at the bottom of this file.
2. [nextjs.org/docs](https://nextjs.org/docs) and [react.dev](https://react.dev)
   for anything the local copy doesn't cover.

Official docs outrank everything else here: your training memory, blog posts,
Stack Overflow, and the third-party skills vendored in `.claude/skills/`. Those
skills are useful for shape and worked examples, but where one disagrees with
the docs, **the docs win** — they lag releases and Next.js moves fast.

Do not pattern-match from memory on a version-sensitive API. When the docs settle
a question, say which page said so. If the docs are silent or ambiguous, say that
too rather than inventing an answer. The `source-driven-development` skill is the
procedure for this.

Before any feature work, read `project-contexts/README.md`. It indexes the
product brief, the stack and its hard constraints, four architecture decisions,
the data model, and the testing strategy.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
