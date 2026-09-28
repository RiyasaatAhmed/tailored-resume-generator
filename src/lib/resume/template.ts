import { RESUME_CSS } from "./css";
import type { Education, Experience, Honor, ResumeJson } from "./schema";

/**
 * Assembles `resume_json` into the HTML the PDF is printed from.
 *
 * The structure mirrors `render_html()` in the source exporter, with the parts
 * that were hardcoded for one person turned into data: the contact block, the
 * document title, and the per-role links.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * `**bold**` is the only markup allowed in bullet text (data-model.md). Escape
 * first so the input can never inject markup, then promote the bold spans.
 */
export function inlineToHtml(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** `2025-05` -> `May 2025`. */
export function formatMonth(value: string): string {
  const [year, month] = value.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** A `null` end date means the role is current. */
export function formatDateRange(start: string, end: string | null): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "Present"}`;
}

function anchor(url: string, text: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
}

function renderHeader(header: ResumeJson["header"]): string {
  const contacts = header.contacts
    .map((contact) => anchor(contact.url, contact.label))
    .join(" | ");

  // The source exporter prefixed contacts with 🌐 and 📧. Dropped deliberately:
  // resume-template.md flags emoji as an ATS risk, and ATS compatibility is a
  // stated product promise.
  return [
    "<header>",
    `<h1>${escapeHtml(header.name)}</h1>`,
    `<div class='headline'>${escapeHtml(header.headline)}</div>`,
    header.location_line
      ? `<div class='meta'>${escapeHtml(header.location_line)}</div>`
      : "",
    contacts ? `<div class='contact'>${contacts}</div>` : "",
    "</header>",
  ].join("");
}

function renderSkills(groups: ResumeJson["skill_groups"]): string {
  if (groups.length === 0) return "";
  const lines = groups
    .map(
      (group) =>
        `<strong>${escapeHtml(group.category)}:</strong> ${escapeHtml(group.skills.join(", "))}`,
    )
    .join("<br/>");
  return `<section><h2>Skills</h2><p class='skills'>${lines}</p></section>`;
}

function renderRole(role: Experience): string {
  const parts = [
    "<div class='role'>",
    "<div class='role-header'>",
    `<span class='role-title'>${escapeHtml(role.title)}</span>`,
    `<span class='role-date'>${escapeHtml(formatDateRange(role.start_date, role.end_date))}</span>`,
    "</div>",
    "<div class='company'>",
    `<span>${escapeHtml(role.location ? `${role.company} — ${role.location}` : role.company)}</span>`,
  ];

  // The role link belongs on the company line, right-aligned by the flex row —
  // never inline in a bullet (data-model.md).
  if (role.link) {
    parts.push(
      `<span class='company-links'>${anchor(role.link.url, `[${role.link.label}]`)}</span>`,
    );
  }
  parts.push("</div>");

  if (role.about) {
    parts.push(`<div class='company-about'>${escapeHtml(role.about)}</div>`);
  }

  if (role.bullets.length > 0) {
    parts.push("<ul>");
    for (const bullet of role.bullets) {
      parts.push(
        "<li><span class='bullet'>•</span>" +
          `<span class='bullet-body'>${inlineToHtml(bullet)}</span></li>`,
      );
    }
    parts.push("</ul>");
  }

  parts.push("</div>");
  return parts.join("");
}

function renderEducation(entries: Education[]): string {
  if (entries.length === 0) return "";
  const rows = entries
    .map((entry) => {
      const dates = entry.start_date
        ? formatDateRange(entry.start_date, entry.end_date ?? null)
        : "";
      const degree = entry.field
        ? `${entry.degree}, ${entry.field}`
        : entry.degree;
      return (
        "<div class='role-header'>" +
        `<span class='role-title'>${escapeHtml(degree)}</span>` +
        `<span class='role-date'>${escapeHtml(dates)}</span>` +
        "</div>" +
        `<div class='company'><span>${escapeHtml(entry.institution)}</span></div>`
      );
    })
    .join("");
  return `<section><h2>Education</h2>${rows}</section>`;
}

function renderHonors(entries: Honor[]): string {
  if (entries.length === 0) return "";
  const rows = entries
    .map((entry) => {
      const suffix = entry.awarded_on ? ` (${formatMonth(entry.awarded_on)})` : "";
      const issuer = entry.issuer
        ? `<div>${escapeHtml(entry.issuer)}</div>`
        : "";
      return (
        "<div class='honor'>" +
        `<div class='honor-title'>${inlineToHtml(entry.title)}${escapeHtml(suffix)}</div>` +
        issuer +
        "</div>"
      );
    })
    .join("");
  return `<section><h2>Honors &amp; Awards</h2>${rows}</section>`;
}

export function renderResumeHtml(resume: ResumeJson): string {
  const experience =
    resume.experience.length > 0
      ? `<section><h2>Experience</h2>${resume.experience.map(renderRole).join("")}</section>`
      : "";

  return [
    "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8' />",
    `<title>${escapeHtml(resume.header.name)} — Resume</title>`,
    '<base target="_blank" />',
    `<style>${RESUME_CSS}</style></head><body>`,
    renderHeader(resume.header),
    `<section><h2>Summary</h2><p class='summary'>${inlineToHtml(resume.summary)}</p></section>`,
    renderSkills(resume.skill_groups),
    experience,
    renderEducation(resume.education),
    renderHonors(resume.honors),
    "</body></html>",
  ].join("");
}
