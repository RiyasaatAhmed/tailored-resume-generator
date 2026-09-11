# Resume document template

<!--
  The visual spec for the PDF — the thing the user actually receives.
  design-system.md is the *app* (marketing site + profile editor) and says
  nothing about the document. Two different surfaces, two different specs.

  Derived, not designed. Read "Why these values are not negotiable" before
  changing any number here.
-->

## Provenance

Every value here is extracted from the `CSS` constant in
`~/Desktop/portfolio/.cursor/skills/resume-md-export/scripts/md_to_pdf.py` and
the Chrome flags in its `convert()`. That rendering has produced the resumes in
`~/Desktop/portfolio/resume/tailored/` — output validated the only way that
counts: sent to real employers.

**This is a lift-and-shift, not a port.** The existing exporter already renders
HTML and prints it through **Chrome headless**. [ADR-0001](../decisions/0001-generation-pipeline.md)
chose an HTML template through **Playwright → Chromium**. Same engine. The CSS
transfers verbatim; only the HTML assembly and the invocation change.

This does not contradict [source-workflow.md](source-workflow.md)'s "do not port
the Python pipeline." That is correct about the *mechanism* — docx templates,
screenshot wrap-checking, the link-patching regex. The typographic values are
the tuned part and are worth keeping even though the code around them is not.

## Page geometry

| Property | Value |
|---|---|
| Page size | A4 (8.268 × 11.693 in) |
| Margins | `0.55in` top/bottom, `0.6in` left/right |
| Content width | **7.068 in** (508.9 pt) |
| Content height | 10.593 in |
| Body font | `"Helvetica Neue", Helvetica, Arial, sans-serif` |
| Body size | **9.5 pt** |
| Body line-height | 1.35 |
| Body color | `#1a1a1a` |
| Link color | `#1155cc`, underlined |

Page size is **A4, not Letter** — worth knowing deliberately, since the
primary users are US-market applicants. Changing it changes the measure and
therefore the bullet rule below.

## Why these values are not negotiable

The "one line per bullet, 90–105 characters" rule in
[data-model.md](data-model.md) and success criteria in
[product.md](product.md) is **not a portable constant.** It is a number that
holds at exactly one combination of page width, margins, font, and type size —
this one:

```
content width            7.068 in  = 508.9 pt
− bullet indent          0.086 in    (• glyph ~0.35em + 0.3em margin, at 9.5pt)
= bullet body            6.982 in  = 502.7 pt

502.7 pt ÷ (0.50em × 9.5pt)  ≈ 106 characters   regular weight
502.7 pt ÷ (0.51em × 9.5pt)  ≈ 104 characters   ~25% bold (typical bullet)
502.7 pt ÷ (0.545em × 9.5pt) ≈  97 characters   bold-heavy bullet
```

The longest bullet in the shipped base resume is **107 characters** and sets on
one line, so the true ceiling is a shade above the estimate. **90–105 is the
authoring range with headroom** — the low end exists because a bullet carrying
2–4 bold spans (which the rewrite rules require) is measurably wider than the
same bullet in regular weight.

Change the font, the size, or the margins and this range is silently wrong —
taking invariant #6 and a stated success criterion with it. If any of them must
change, recompute the range; do not carry 90–105 across.

## Component styles

Transfer as-is. Sizes are the load-bearing part; colors and spacing are
adjustable without invalidating the bullet rule.

| Element | Spec |
|---|---|
| `h1` (name) | 20pt / 700 / `letter-spacing: -0.02em` |
| `.headline` | 10pt / 600 / `#333`, centered |
| `.meta`, `.contact` | 9pt / `#444`, centered |
| `h2` (section) | 10pt / 700 / uppercase / `letter-spacing: 0.06em`, 1px `#ccc` bottom rule |
| `.role-title` | 9.5pt / 700 |
| `.role-date` | 9pt / `#444` / `white-space: nowrap` |
| `.company` | 9pt / `#333` |
| `.company-about` | 8.5pt / `#555` / italic |
| `.skills` | 9.5pt / line-height 1.4 |
| `.summary` | body size, `text-align: justify` |

**Layout mechanics worth preserving:**

- `.role-header` and `.company` are flex rows with `justify-content: space-between`
  — this is what right-aligns the date against the title and the `[View Project]`
  links against the company name. `data-model.md` already specifies that role
  links render on the company line rather than inline in a bullet; this is the
  mechanism.
- Bullets are `display: flex` with a separate `.bullet` span, not `list-style`.
  That gives a hanging indent where wrapped text aligns under the first character
  rather than under the marker.
- `.company-links` and `.role-date` are `white-space: nowrap` so they never wrap
  away from their row.

## What carries over for free

**`.role { break-inside: avoid; }` already solves the orphaned-role rule.**
The source command (Phase 1 Step 5, "Page break rule") describes this as a manual
post-export check: render, look at the PDF, insert a page break if a role
straddles the boundary. The CSS handles it declaratively. Nothing to port, and
nothing to re-implement in the pipeline.

This shrinks one of the audit's open items: of the page-related rules, only
"one page unless the posting asks for longer" remains unaddressed, and that is a
content-selection decision (how many bullets and roles to include), not a
rendering one.

## What must be parameterized

`render_html()` is written for one person. These are hardcoded and become
per-user data:

| Hardcoded in the exporter | Becomes |
|---|---|
| Contact block — `riyasaat.dev`, the email, LinkedIn / StackOverflow / Github | `profiles.contacts` (jsonb, ordered) — already in the data model |
| `<title>Riyasaat's Resume</title>` | `profiles.full_name` |
| `resume_links.py` `CONTACT` dict | same as above |
| `resume_links.py` company-website URL map | `experiences.link_url` / `link_label` |
| The 🌐 and 📧 emoji in the contact line | Decide: keep, or drop for ATS safety — emoji parse unpredictably in some resume parsers |

## Schema gap this surfaced

The template renders a `.company-about` line — a one-sentence description of the
employer, italic at 8.5pt, sitting between the company line and the bullets:

> *AI healthcare SaaS for Medicare risk adjustment (HCC) and RADV audits, part of
> the John Snow Labs group.*

**There is nowhere to put it.** `data-model.md`'s `experiences` table has
`company`, `title`, `location`, `start_date`, `end_date`, `position` — no
`about`. `resume_json.experience[]` has no field for it either.

It earns its place: a recruiter who does not recognize the employer gets the
context to read the bullets correctly, which matters for a candidate whose
history is mostly small companies. Add `experiences.about` (text, nullable) and a
matching optional `about` in the `resume_json` experience objects, or decide
deliberately to drop the line.

## Playwright migration — verify, do not assume

Three Chrome-headless specifics that may not transfer cleanly:

1. **`--no-pdf-header-footer`** → Playwright's `page.pdf({ displayHeaderFooter: false })`,
   which is already the default. Confirm no default header/footer appears.
2. **`@page { size: A4 }`** is honored by Chrome's print path. Playwright also
   accepts `page.pdf({ format: 'A4' })`. Set it in both places rather than
   relying on the CSS alone.
3. **The link patch.** `patch_pdf_links_new_tab()` is a regex rewrite over the
   emitted PDF bytes, adding `/NewWindow true` to URI actions, and its own
   comment flags it as fragile. Check whether Playwright's `page.pdf()` needs it
   at all before porting it — and if the only effect is whether links open in a
   new tab, consider dropping it rather than carrying a byte-level PDF hack into
   the product.

Render a known-good input through Playwright and diff against the corresponding
file in `~/Desktop/portfolio/resume/tailored/` before trusting any of this.
