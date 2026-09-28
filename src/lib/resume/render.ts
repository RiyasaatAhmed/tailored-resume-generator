import { chromium, type Browser, type Page } from "playwright";

import { CONTENT_WIDTH_PX } from "./css";
import { renderResumeHtml } from "./template";
import type { ResumeJson } from "./schema";

/**
 * `resume_json` -> HTML -> PDF, plus the bullet wrap check.
 *
 * Two things here are load-bearing and documented in
 * `reference/resume-template.md`:
 *
 * 1. `format: 'A4'` must be passed explicitly. Playwright ignores
 *    `@page { size: A4 }` and silently emits US Letter (612x792pt), which is
 *    wider — so over-long bullets fit, and invariant #6 fails permissively.
 * 2. The wrap check must run under print emulation at the A4 content width.
 *    Measuring on the default 1280px viewport measures the screen layout, where
 *    nothing wraps: a false pass.
 */

/** A4 in PostScript points, what `page.pdf({ format: 'A4' })` should emit. */
export const A4_POINTS = { width: 595, height: 842 } as const;

export interface WrappedBullet {
  roleIndex: number;
  bulletIndex: number;
  text: string;
  lines: number;
}

export interface RenderResult {
  pdf: Buffer;
  html: string;
  /** Empty when every bullet sets on one line. */
  wrappedBullets: WrappedBullet[];
}

/**
 * Counts rendered lines per bullet in the DOM. Cheaper than writing a PDF and
 * re-parsing it, and it runs before the PDF exists — so a wrapping bullet can
 * be caught without a round trip through the renderer.
 */
async function findWrappedBullets(page: Page): Promise<WrappedBullet[]> {
  return page.evaluate(() => {
    const wrapped: {
      roleIndex: number;
      bulletIndex: number;
      text: string;
      lines: number;
    }[] = [];

    document.querySelectorAll(".role").forEach((role, roleIndex) => {
      role.querySelectorAll(".bullet-body").forEach((node, bulletIndex) => {
        const el = node as HTMLElement;
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
        if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
        const lines = Math.round(el.getBoundingClientRect().height / lineHeight);
        if (lines > 1) {
          wrapped.push({
            roleIndex,
            bulletIndex,
            text: el.textContent ?? "",
            lines,
          });
        }
      });
    });

    return wrapped;
  });
}

export async function renderResumePdf(
  resume: ResumeJson,
  options: { browser?: Browser } = {},
): Promise<RenderResult> {
  const html = renderResumeHtml(resume);
  const browser = options.browser ?? (await chromium.launch());
  const ownsBrowser = !options.browser;

  try {
    const page = await browser.newPage({
      viewport: { width: CONTENT_WIDTH_PX, height: 950 },
    });

    try {
      // @page and break-inside only apply in print; the wrap measurement is
      // meaningless without this.
      await page.emulateMedia({ media: "print" });
      await page.setContent(html, { waitUntil: "load" });

      const wrappedBullets = await findWrappedBullets(page);

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
      });

      return { pdf, html, wrappedBullets };
    } finally {
      await page.close();
    }
  } finally {
    if (ownsBrowser) await browser.close();
  }
}

/**
 * Renders and throws if any bullet wraps — invariant #6 and a stated success
 * criterion in `product.md`. Use this on the generation path; use
 * `renderResumePdf` when you want to inspect the failures instead.
 */
export async function renderResumePdfStrict(
  resume: ResumeJson,
  options: { browser?: Browser } = {},
): Promise<RenderResult> {
  const result = await renderResumePdf(resume, options);

  if (result.wrappedBullets.length > 0) {
    const detail = result.wrappedBullets
      .map(
        (b) =>
          `  role ${b.roleIndex}, bullet ${b.bulletIndex} (${b.lines} lines, ${b.text.length} chars): ${b.text}`,
      )
      .join("\n");
    throw new Error(
      `${result.wrappedBullets.length} bullet(s) wrapped to a second line:\n${detail}`,
    );
  }

  return result;
}
