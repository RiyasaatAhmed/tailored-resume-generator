import type { ResumeJson } from "./schema";

/**
 * A hand-written, well-populated resume for render tests.
 *
 * Deliberately a fake identity. `source-workflow.md` names the owner's real
 * resume as the eventual fixture source, but that needs a redaction decision
 * before it can land in git — this unblocks the renderer in the meantime.
 *
 * Bullets sit in the 90-105 character authoring range from
 * `resume-template.md`, each carrying 2-4 bold spans, so the fixture also
 * documents what "good input" looks like.
 */
export const sampleResume: ResumeJson = {
  header: {
    name: "Jordan Avery",
    headline: "Senior Frontend Engineer | TypeScript · React · Next.js",
    location_line: "Remote-First (US Timezone Aligned)",
    contacts: [
      { label: "jordanavery.dev", url: "https://jordanavery.dev" },
      { label: "jordan@example.com", url: "mailto:jordan@example.com" },
      { label: "LinkedIn", url: "https://linkedin.com/in/example" },
      { label: "GitHub", url: "https://github.com/example" },
    ],
  },
  summary:
    "Frontend engineer with eight years building data-dense product surfaces. Recent work focused on " +
    "render performance and the measurement discipline that keeps it from regressing.",
  skill_groups: [
    {
      category: "Frontend",
      skills: ["typescript", "react", "next.js", "tailwind", "radix"],
    },
    {
      category: "Testing",
      skills: ["vitest", "playwright", "testing-library", "msw"],
    },
    {
      category: "Backend",
      skills: ["node", "postgres", "drizzle", "trpc"],
    },
  ],
  experience: [
    {
      company: "Northwind Analytics",
      title: "Senior Frontend Engineer",
      location: "Delaware, United States (Remote)",
      about:
        "Workforce analytics SaaS for mid-market operations teams, part of the Northwind group.",
      start_date: "2023-04",
      end_date: null,
      link: { label: "View Project", url: "https://example.com/case-study" },
      bullets: [
        "Cut time to first response from **12s to 380ms** by moving search onto a **Postgres** view",
        "Rebuilt the reporting grid in **React 19**, dropping p95 interaction latency by **48%**",
        "Introduced **Playwright** visual checks that caught **31** layout regressions pre-release",
      ],
    },
    {
      company: "Harborline",
      title: "Frontend Engineer",
      location: "Remote",
      start_date: "2020-08",
      end_date: "2023-03",
      bullets: [
        "Shipped a **design-token** pipeline adopted by **6** teams, cutting CSS bundle **34%**",
        "Migrated **142** class components to hooks with zero customer-reported regressions",
      ],
    },
  ],
  education: [
    {
      institution: "University of Leeds",
      degree: "BSc",
      field: "Computer Science",
      start_date: "2013-09",
      end_date: "2016-06",
    },
  ],
  honors: [
    {
      title: "Internal Engineering Excellence Award",
      issuer: "Northwind Analytics",
      awarded_on: "2024-11",
    },
  ],
};

/** The same resume with everything optional stripped — the sparse-input case. */
export const minimalResume: ResumeJson = {
  header: {
    name: "Sam Okafor",
    headline: "Backend Engineer | Go · Postgres",
    contacts: [],
  },
  summary: "Backend engineer focused on data pipelines and queue reliability.",
  skill_groups: [],
  experience: [
    {
      company: "Solo Consulting",
      title: "Contract Engineer",
      start_date: "2022-01",
      end_date: null,
      bullets: ["Built an ingestion pipeline processing **4M** events per day"],
    },
  ],
  education: [],
  honors: [],
};
