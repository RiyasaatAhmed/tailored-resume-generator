import { describe, expect, it } from "vitest";

import { sampleResume, minimalResume } from "./fixtures";
import { resumeJsonSchema } from "./schema";
import {
  escapeHtml,
  formatDateRange,
  formatMonth,
  inlineToHtml,
  renderResumeHtml,
} from "./template";

describe("schema", () => {
  it("accepts both fixtures", () => {
    expect(() => resumeJsonSchema.parse(sampleResume)).not.toThrow();
    expect(() => resumeJsonSchema.parse(minimalResume)).not.toThrow();
  });

  it("rejects more than 4 bullets in a role", () => {
    const tooMany = structuredClone(sampleResume);
    tooMany.experience[0].bullets = ["a", "b", "c", "d", "e"];
    expect(() => resumeJsonSchema.parse(tooMany)).toThrow();
  });

  it("rejects a date that is not YYYY-MM", () => {
    const badDate = structuredClone(sampleResume);
    badDate.experience[0].start_date = "2023-4";
    expect(() => resumeJsonSchema.parse(badDate)).toThrow();
  });
});

describe("inlineToHtml", () => {
  it("promotes **bold** to <strong>", () => {
    expect(inlineToHtml("Cut latency by **48%** overall")).toBe(
      "Cut latency by <strong>48%</strong> overall",
    );
  });

  it("escapes markup before promoting bold, so input cannot inject HTML", () => {
    expect(inlineToHtml("<script>alert(1)</script> **safe**")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt; <strong>safe</strong>",
    );
  });

  it("leaves a lone asterisk pair alone", () => {
    expect(inlineToHtml("2 * 3 * 4")).toBe("2 * 3 * 4");
  });
});

describe("date formatting", () => {
  it("formats a month", () => {
    expect(formatMonth("2025-05")).toBe("May 2025");
    expect(formatMonth("2023-12")).toBe("Dec 2023");
  });

  it("renders a null end date as Present", () => {
    expect(formatDateRange("2023-04", null)).toBe("Apr 2023 – Present");
  });

  it("renders a closed range", () => {
    expect(formatDateRange("2020-08", "2023-03")).toBe("Aug 2020 – Mar 2023");
  });
});

describe("escapeHtml", () => {
  it("escapes the ampersand first so entities are not double-encoded", () => {
    expect(escapeHtml("Tom & Jerry <b>")).toBe("Tom &amp; Jerry &lt;b&gt;");
  });
});

describe("renderResumeHtml", () => {
  const html = renderResumeHtml(sampleResume);

  it("titles the document with the candidate name", () => {
    expect(html).toContain("<title>Jordan Avery — Resume</title>");
  });

  it("puts the role link on the company line, not inside a bullet", () => {
    const companyLine = html.slice(
      html.indexOf("<div class='company'>"),
      html.indexOf("</div><ul>"),
    );
    expect(companyLine).toContain("company-links");
    expect(companyLine).toContain("[View Project]");

    const bulletBodies = html.match(/<span class='bullet-body'>.*?<\/span>/g) ?? [];
    expect(bulletBodies.length).toBeGreaterThan(0);
    for (const body of bulletBodies) {
      expect(body).not.toContain("View Project");
    }
  });

  it("renders the company-about line when present", () => {
    expect(html).toContain("class='company-about'");
    expect(html).toContain("Workforce analytics SaaS");
  });

  it("does not emit contact emoji, which parse unpredictably in ATS", () => {
    expect(html).not.toContain("🌐");
    expect(html).not.toContain("📧");
  });

  it("omits empty sections rather than rendering empty headings", () => {
    const sparse = renderResumeHtml(minimalResume);
    expect(sparse).not.toContain("<h2>Education</h2>");
    expect(sparse).not.toContain("<h2>Honors");
    expect(sparse).not.toContain("<h2>Skills</h2>");
    expect(sparse).toContain("<h2>Experience</h2>");
  });
});
