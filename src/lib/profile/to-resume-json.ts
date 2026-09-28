import type { ResumeJson } from "@/lib/resume/schema";
import type { FullProfile } from "./repository";

/**
 * The stored profile, rendered as `resume_json`.
 *
 * This is the base resume — the user's own material, untailored. The rewrite
 * step will later produce the same shape from a job posting; until then this is
 * what the renderer receives, which means the PDF path is exercisable without
 * spending anything on the model.
 */

/** `2023-04-01` (a Postgres date) -> `2023-04` (what resume_json expects). */
export function toYearMonth(date: string): string {
  return date.slice(0, 7);
}

/**
 * What is still missing before this profile can be rendered.
 *
 * `resume_json` requires a name, headline, and summary; a half-filled profile
 * genuinely cannot produce a valid resume. Rather than relaxing the schema —
 * which is the renderer's contract and the rewrite step's output shape — the
 * editor asks this and tells the user what to fill in.
 *
 * Empty means ready to render.
 */
export function getMissingForRender(profile: FullProfile): string[] {
  const missing: string[] = [];
  if (!profile.fullName.trim()) missing.push("your name");
  if (!profile.headline?.trim()) missing.push("a headline");
  if (!profile.summary?.trim()) missing.push("a summary");
  if (profile.experiences.length === 0) missing.push("at least one role");

  const rolesWithoutBullets = profile.experiences.filter(
    (role) => role.bullets.filter((b) => !b.inBank).length === 0,
  );
  if (rolesWithoutBullets.length > 0) {
    missing.push(
      `a bullet for ${rolesWithoutBullets.map((r) => r.company).join(", ")}`,
    );
  }

  return missing;
}

export interface ToResumeJsonOptions {
  /**
   * Include bullets held in the bank.
   *
   * Default false, and that default is load-bearing. `in_bank` bullets are
   * true and verified but deliberately kept off the default resume for space —
   * they render only when the rewrite explicitly selects them. Nothing selects
   * them yet, so including them here would silently pad every resume with
   * overflow the user chose to hold back.
   */
  includeBankedBullets?: boolean;
}

export function profileToResumeJson(
  profile: FullProfile,
  options: ToResumeJsonOptions = {},
): ResumeJson {
  const { includeBankedBullets = false } = options;

  return {
    header: {
      name: profile.fullName,
      headline: profile.headline ?? "",
      location_line: profile.locationLine ?? undefined,
      contacts: profile.contacts,
    },
    summary: profile.summary ?? "",
    skill_groups: profile.skillGroups
      // A group with no skills would render as a dangling label.
      .filter((group) => group.skills.length > 0)
      .map((group) => ({
        category: group.category,
        skills: group.skills.map((skill) => skill.name),
      })),
    experience: profile.experiences.map((role) => {
      const bullets = role.bullets.filter(
        (bullet) => includeBankedBullets || !bullet.inBank,
      );

      // The role link lives on the company line. The data model hangs it off
      // individual bullets, so take the first bullet that carries one.
      const linked = bullets.find((b) => b.linkLabel && b.linkUrl);

      return {
        company: role.company,
        title: role.title,
        location: role.location ?? undefined,
        about: role.about ?? undefined,
        start_date: toYearMonth(role.startDate),
        end_date: role.endDate ? toYearMonth(role.endDate) : null,
        link: linked
          ? { label: linked.linkLabel!, url: linked.linkUrl! }
          : null,
        // Max 4 per role (data-model.md). Truncating here keeps the schema
        // valid; the editor warns before it gets this far.
        bullets: bullets.slice(0, 4).map((bullet) => bullet.text),
      };
    }),
    education: profile.education.map((entry) => ({
      institution: entry.institution,
      degree: entry.degree,
      field: entry.field ?? undefined,
      start_date: entry.startDate ? toYearMonth(entry.startDate) : undefined,
      end_date: entry.endDate ? toYearMonth(entry.endDate) : null,
    })),
    honors: profile.honors.map((entry) => ({
      title: entry.title,
      issuer: entry.issuer ?? undefined,
      awarded_on: entry.awardedOn ? toYearMonth(entry.awardedOn) : undefined,
    })),
  };
}
