import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

import { minimalResume, sampleResume } from "./fixtures";
import { renderResumePdf, renderResumePdfStrict } from "./render";
import type { ResumeJson } from "./schema";

/**
 * Layer 5 of `reference/testing-strategy.md` — the rendered document.
 *
 * One browser for the whole file; launching per test roughly triples runtime.
 */
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

/**
 * Reads the page box straight out of the PDF. `resume-template.md` found a
 * 0.96pt drift between drivers' A4 rounding, so this compares with tolerance —
 * a byte-level comparison would never be clean.
 */
function readPageSize(pdf: Buffer): { width: number; height: number } {
  const match = pdf
    .toString("latin1")
    .match(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (!match) throw new Error("no MediaBox found in PDF");
  return { width: Number(match[1]), height: Number(match[2]) };
}

describe("renderResumePdf", () => {
  it("emits A4, not US Letter", async () => {
    const { pdf } = await renderResumePdf(sampleResume, { browser });
    const { width, height } = readPageSize(pdf);

    // A4 is 595x842pt; US Letter is 612x792pt. Playwright ignores
    // `@page { size: A4 }` and silently defaults to Letter, which is wider —
    // so bullets that should fail the wrap check would pass.
    expect(width).toBeGreaterThan(594);
    expect(width).toBeLessThan(597);
    expect(height).toBeGreaterThan(841);
    expect(height).toBeLessThan(844);
  });

  it("produces a non-trivial PDF", async () => {
    const { pdf } = await renderResumePdf(sampleResume, { browser });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  // Invariant #6, and a stated success criterion in product.md.
  it("sets every bullet in the fixture on one line", async () => {
    const { wrappedBullets } = await renderResumePdf(sampleResume, { browser });
    expect(wrappedBullets).toEqual([]);
  });

  /**
   * The check above is only meaningful if it can fail. Without this test a
   * broken measurement — wrong viewport, screen media, a selector typo — would
   * report zero wrapped bullets forever and the suite would stay green.
   */
  it("detects a bullet that is too long to fit on one line", async () => {
    const tooLong: ResumeJson = structuredClone(sampleResume);
    tooLong.experience[0].bullets = [
      "Rebuilt the entire reporting surface end to end across every supported browser and locale, " +
        "coordinating with four teams and shipping it behind a staged feature flag over two quarters",
    ];

    const { wrappedBullets } = await renderResumePdf(tooLong, { browser });
    expect(wrappedBullets).toHaveLength(1);
    expect(wrappedBullets[0].lines).toBeGreaterThan(1);
    expect(wrappedBullets[0].roleIndex).toBe(0);
  });

  it("renders a resume with no education, honors, or skills", async () => {
    const { pdf, wrappedBullets } = await renderResumePdf(minimalResume, {
      browser,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(wrappedBullets).toEqual([]);
  });

  it("keeps break-inside: avoid on roles so one cannot straddle a page break", async () => {
    const { html } = await renderResumePdf(minimalResume, { browser });
    expect(html).toContain("break-inside: avoid");
  });
});

describe("renderResumePdfStrict", () => {
  it("resolves when no bullet wraps", async () => {
    await expect(
      renderResumePdfStrict(sampleResume, { browser }),
    ).resolves.toBeDefined();
  });

  it("throws, naming the offending bullet, when one wraps", async () => {
    const tooLong: ResumeJson = structuredClone(sampleResume);
    tooLong.experience[0].bullets = [
      "Rebuilt the entire reporting surface end to end across every supported browser and locale, " +
        "coordinating with four teams and shipping it behind a staged feature flag over two quarters",
    ];

    await expect(
      renderResumePdfStrict(tooLong, { browser }),
    ).rejects.toThrow(/wrapped to a second line/);
  });
});
