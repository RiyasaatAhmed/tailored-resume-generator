# Long-running Node host with a Postgres-backed job queue

- Status: accepted
- Date: 2026-09-11

## Context and problem statement

Generation takes 60–120 seconds and ends in a Playwright → Chromium PDF render.
Neither fits a serverless request. The default Next.js deployment target (Vercel
serverless) is therefore not viable for the generation path, which constrains
hosting before any code is written.

## Decision drivers

- "One repo, one deploy" was an explicit goal in choosing Next.js full-stack.
- Work must survive a closed browser tab.
- Playwright needs a real Chromium binary and a writable filesystem.
- Avoid standing up infrastructure the workload does not justify.

## Decision

Deploy the whole Next.js app to a **long-running Node host** (Railway, Fly, or
Render) rather than Vercel serverless. Chromium is installed in the container.

Jobs run through **`pg-boss`**, a Postgres-backed queue, in a worker started
alongside the app. Flow:

1. `POST /api/generations` validates input, enqueues, returns a generation id.
2. The worker runs research → rewrite → render, writing phase transitions to the
   generation row.
3. `GET /api/generations/:id/stream` is an SSE endpoint the client subscribes to
   for progress.

## Consequences

- Good: one deploy, one container, no second service.
- Good: no Redis. The database is already a dependency.
- Good: closing the tab does not lose the work or the money already spent.
- Bad: gives up Vercel's preview deploys and edge network for the Next.js
  frontend.
- Bad: app and worker share a process, so a runaway generation can affect request
  latency. Acceptable at expected volume; split the worker out when it isn't.

## Rejected options

**Vercel serverless.** Function duration limits and no persistent Chromium make
the generation path unworkable. Would require splitting the worker to another
provider anyway, which defeats the one-deploy goal.

**Vercel frontend + separate worker service.** Viable and the natural next step if
we outgrow the shared process, but it is two deploys and two environments to
configure on day one.

**BullMQ / Redis.** A second piece of infrastructure for a workload measured in
jobs per minute.

**Long-lived HTTP request with a streamed response.** Simpler to build, but a
closed tab or proxy timeout loses a job that has already cost real money.
