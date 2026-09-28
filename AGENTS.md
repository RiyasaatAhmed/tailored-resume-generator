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
```

Scaffolded, but only one slice is built: the PDF renderer
(`src/lib/resume/`). No database, auth, billing, or generation pipeline yet.

`src/lib/resume/css.ts` is ported **verbatim** from the Python exporter. The
"one line per bullet, 90–105 characters" rule holds only at that exact
combination of page size, margins, font, and type size. Change a value there and
recompute the range — do not carry it across. `page.pdf()` must always pass
`format: 'A4'`; Playwright ignores `@page { size: A4 }` and silently emits US
Letter, which is wider and lets over-long bullets through.

Before any feature work, read `project-contexts/README.md`. It indexes the
product brief, the stack and its hard constraints, four architecture decisions,
the data model, and the testing strategy.
