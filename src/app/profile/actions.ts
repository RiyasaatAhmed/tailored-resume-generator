"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDatabase } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/cookies";
import {
  addBullet,
  addExperience,
  addSkillGroup,
  deleteBullet,
  deleteExperience,
  deleteSkillGroup,
  getOrCreateProfile,
  setBulletInBank,
  updateProfileHeader,
} from "@/lib/profile/repository";

/**
 * Profile editor actions.
 *
 * Every one re-reads the session rather than trusting an id from the form —
 * a profile id in a hidden field would otherwise let one user edit another's
 * profile.
 */

export interface ActionState {
  error?: string;
}

async function requireProfile() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return {
    user,
    profile: await getOrCreateProfile(getDatabase(), user.id),
  };
}

/** `YYYY-MM` from a month input, stored as the first of that month. */
const monthToDate = (value: string) => `${value}-01`;

const headerSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name"),
  headline: z.string().trim(),
  locationLine: z.string().trim(),
  summary: z.string().trim(),
});

export async function saveHeaderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireProfile();

  const parsed = headerSchema.safeParse({
    fullName: formData.get("fullName"),
    headline: formData.get("headline"),
    locationLine: formData.get("locationLine"),
    summary: formData.get("summary"),
  });
  if (!parsed.success) {
    return { error: z.flattenError(parsed.error).fieldErrors.fullName?.[0] };
  }

  // Contacts arrive as paired label/url rows; drop any row missing either half.
  const labels = formData.getAll("contactLabel").map(String);
  const urls = formData.getAll("contactUrl").map(String);
  const contacts = labels
    .map((label, i) => ({ label: label.trim(), url: (urls[i] ?? "").trim() }))
    .filter((c) => c.label && c.url);

  await updateProfileHeader(getDatabase(), profile.id, {
    fullName: parsed.data.fullName,
    headline: parsed.data.headline || null,
    locationLine: parsed.data.locationLine || null,
    summary: parsed.data.summary || null,
    contacts,
  });

  revalidatePath("/profile");
  return {};
}

const experienceSchema = z.object({
  company: z.string().trim().min(1, "Enter the company"),
  title: z.string().trim().min(1, "Enter the title"),
  location: z.string().trim(),
  about: z.string().trim(),
  startDate: z.string().regex(/^\d{4}-\d{2}$/, "Enter a start month"),
  endDate: z.union([z.string().regex(/^\d{4}-\d{2}$/), z.literal("")]),
});

export async function addExperienceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireProfile();

  const parsed = experienceSchema.safeParse({
    company: formData.get("company"),
    title: formData.get("title"),
    location: formData.get("location"),
    about: formData.get("about"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
  });
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return {
      error:
        flat.company?.[0] ??
        flat.title?.[0] ??
        flat.startDate?.[0] ??
        "Check the role details",
    };
  }

  await addExperience(getDatabase(), profile.id, {
    company: parsed.data.company,
    title: parsed.data.title,
    location: parsed.data.location || null,
    about: parsed.data.about || null,
    startDate: monthToDate(parsed.data.startDate),
    endDate: parsed.data.endDate ? monthToDate(parsed.data.endDate) : null,
  });

  revalidatePath("/profile");
  return {};
}

export async function addBulletAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();

  const experienceId = String(formData.get("experienceId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const linkLabel = String(formData.get("linkLabel") ?? "").trim();
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();

  if (!experienceId || !text) return { error: "Enter the bullet text" };

  await addBullet(getDatabase(), experienceId, {
    text,
    inBank: formData.get("inBank") === "on",
    linkLabel: linkLabel || null,
    linkUrl: linkUrl || null,
  });

  revalidatePath("/profile");
  return {};
}

export async function addSkillGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireProfile();

  const category = String(formData.get("category") ?? "").trim();
  const names = String(formData.get("skills") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!category) return { error: "Name the group" };
  if (names.length === 0) return { error: "Add at least one skill" };

  await addSkillGroup(getDatabase(), profile.id, category, names);
  revalidatePath("/profile");
  return {};
}

export async function deleteExperienceAction(formData: FormData) {
  await requireProfile();
  await deleteExperience(getDatabase(), String(formData.get("experienceId")));
  revalidatePath("/profile");
}

export async function deleteBulletAction(formData: FormData) {
  await requireProfile();
  await deleteBullet(getDatabase(), String(formData.get("bulletId")));
  revalidatePath("/profile");
}

export async function deleteSkillGroupAction(formData: FormData) {
  await requireProfile();
  await deleteSkillGroup(getDatabase(), String(formData.get("groupId")));
  revalidatePath("/profile");
}

export async function toggleBulletBankAction(formData: FormData) {
  await requireProfile();
  await setBulletInBank(
    getDatabase(),
    String(formData.get("bulletId")),
    formData.get("inBank") === "true",
  );
  revalidatePath("/profile");
}
