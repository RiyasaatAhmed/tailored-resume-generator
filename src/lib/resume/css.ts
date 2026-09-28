/**
 * Ported verbatim from the `CSS` constant in
 * `~/Desktop/portfolio/.cursor/skills/resume-md-export/scripts/md_to_pdf.py`.
 *
 * `reference/resume-template.md` is explicit that this is a lift-and-shift, not
 * a port: the same values have produced resumes that went to real employers,
 * and the "one line per bullet, 90-105 characters" rule holds at exactly this
 * combination of page width, margins, font, and size. Change a number here and
 * that rule is silently wrong — recompute the range, do not carry it across.
 *
 * `@page { size: A4 }` is retained for parity with the source, but Playwright
 * ignores it. `format: 'A4'` must be passed to `page.pdf()` explicitly; see
 * `renderPdf`.
 */
export const RESUME_CSS = `
@page { size: A4; margin: 0.55in 0.6in; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9.5pt; line-height: 1.35; color: #1a1a1a; }
h1 { font-size: 20pt; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
.headline { font-size: 10pt; font-weight: 600; color: #333; margin-bottom: 3px; text-align: center; }
.meta, .contact { font-size: 9pt; color: #444; text-align: center; }
.contact a, li a, .honor a, .company a { color: #1155cc; text-decoration: underline; }
section { margin-top: 10px; }
h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 6px; }
.summary { text-align: justify; }
.skills { font-size: 9.5pt; line-height: 1.4; }
.role { margin-bottom: 8px; break-inside: avoid; }
.role-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 2px; }
.role-title { font-weight: 700; font-size: 9.5pt; }
.role-date { font-size: 9pt; white-space: nowrap; color: #444; }
.company { font-size: 9pt; color: #333; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.company-links { white-space: nowrap; }
.company-about { font-size: 8.5pt; color: #555; font-style: italic; margin-bottom: 3px; }
ul { list-style: none; padding-left: 0; margin: 0; }
li { display: flex; align-items: flex-start; margin-bottom: 2px; }
.bullet { flex: 0 0 auto; margin-right: 0.3em; }
.bullet-body { flex: 1; min-width: 0; }
.honor { margin-bottom: 4px; }
.honor-title { font-weight: 600; }
header { text-align: center; }
`;

/** A4 content width at 96 dpi — 7.068in. The viewport the wrap check runs at. */
export const CONTENT_WIDTH_PX = Math.round(7.068 * 96);
