import { z } from "zod";

/**
 * The `generations.resume_json` contract from
 * `project-contexts/reference/data-model.md`.
 *
 * This is the seam between the rewrite call's structured output and the
 * renderer. Changing it means changing the prompt schema and the PDF template
 * together — read the data model before touching anything here.
 */

/** `YYYY-MM`. Resume dates are month-precision; `null` on an end date is "Present". */
const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "expected YYYY-MM");

export const contactSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
});

export const roleLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
});

export const skillGroupSchema = z.object({
  category: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
});

export const experienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  /**
   * One sentence describing the employer, rendered italic between the company
   * line and the bullets. `resume-template.md` surfaced that the exporter
   * renders this but the data model has nowhere to put it; optional here so the
   * line can render without forcing a value.
   */
  about: z.string().optional(),
  start_date: yearMonth,
  end_date: yearMonth.nullable(),
  /** Renders right-aligned on the company line — never inline in a bullet. */
  link: roleLinkSchema.nullable().optional(),
  /** Max 4 per role (data-model.md). `**bold**` is the only markup allowed. */
  bullets: z.array(z.string().min(1)).max(4),
});

export const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  start_date: yearMonth.optional(),
  end_date: yearMonth.nullable().optional(),
});

export const honorSchema = z.object({
  title: z.string().min(1),
  issuer: z.string().optional(),
  awarded_on: yearMonth.optional(),
});

export const resumeJsonSchema = z.object({
  header: z.object({
    name: z.string().min(1),
    /** "Exact Job Title | Stack | Specialty" — mirrors the posting's title. */
    headline: z.string().min(1),
    location_line: z.string().optional(),
    contacts: z.array(contactSchema),
  }),
  summary: z.string().min(1),
  skill_groups: z.array(skillGroupSchema),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  honors: z.array(honorSchema),
});

export type Contact = z.infer<typeof contactSchema>;
export type RoleLink = z.infer<typeof roleLinkSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Honor = z.infer<typeof honorSchema>;
export type ResumeJson = z.infer<typeof resumeJsonSchema>;
