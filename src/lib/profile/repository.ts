import { asc, eq, inArray } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  education,
  experienceBullets,
  experiences,
  honors,
  profiles,
  skillGroups,
  skills,
} from "@/db/schema";

/**
 * Reading and writing the structured profile.
 *
 * Per ADR-0002 this is the canonical source: where it and an uploaded source
 * document disagree, this wins. It is also what the renderer reads for layout.
 *
 * Every list is ordered by its `position` column, never by `created_at` — the
 * ordering is user-controlled.
 */

export interface FullProfile {
  id: string;
  userId: string;
  fullName: string;
  headline: string | null;
  locationLine: string | null;
  summary: string | null;
  contacts: { label: string; url: string }[];
  experiences: {
    id: string;
    company: string;
    title: string;
    location: string | null;
    about: string | null;
    startDate: string;
    endDate: string | null;
    position: number;
    bullets: {
      id: string;
      text: string;
      inBank: boolean;
      linkLabel: string | null;
      linkUrl: string | null;
      position: number;
    }[];
  }[];
  skillGroups: {
    id: string;
    category: string;
    position: number;
    skills: { id: string; name: string; position: number }[];
  }[];
  education: {
    id: string;
    institution: string;
    degree: string;
    field: string | null;
    startDate: string | null;
    endDate: string | null;
    position: number;
  }[];
  honors: {
    id: string;
    title: string;
    issuer: string | null;
    awardedOn: string | null;
    position: number;
  }[];
}

/**
 * The profile row, created on first access.
 *
 * A user always has exactly one profile (`profiles.user_id` is unique), so
 * creating it lazily keeps signup simple and means the editor never has to
 * handle a missing row.
 */
export async function getOrCreateProfile(
  db: Database,
  userId: string,
  fallbackName = "",
) {
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(profiles)
    .values({ userId, fullName: fallbackName })
    .returning();
  return created;
}

export async function getFullProfile(
  db: Database,
  userId: string,
): Promise<FullProfile | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return null;

  const roleRows = await db
    .select()
    .from(experiences)
    .where(eq(experiences.profileId, profile.id))
    .orderBy(asc(experiences.position));

  // One query for every bullet rather than one per role.
  const bulletRows = roleRows.length
    ? await db
        .select()
        .from(experienceBullets)
        .where(
          inArray(
            experienceBullets.experienceId,
            roleRows.map((r) => r.id),
          ),
        )
        .orderBy(asc(experienceBullets.position))
    : [];

  const groupRows = await db
    .select()
    .from(skillGroups)
    .where(eq(skillGroups.profileId, profile.id))
    .orderBy(asc(skillGroups.position));

  const skillRows = groupRows.length
    ? await db
        .select()
        .from(skills)
        .where(
          inArray(
            skills.groupId,
            groupRows.map((g) => g.id),
          ),
        )
        .orderBy(asc(skills.position))
    : [];

  const educationRows = await db
    .select()
    .from(education)
    .where(eq(education.profileId, profile.id))
    .orderBy(asc(education.position));

  const honorRows = await db
    .select()
    .from(honors)
    .where(eq(honors.profileId, profile.id))
    .orderBy(asc(honors.position));

  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    headline: profile.headline,
    locationLine: profile.locationLine,
    summary: profile.summary,
    contacts: profile.contacts ?? [],
    experiences: roleRows.map((role) => ({
      id: role.id,
      company: role.company,
      title: role.title,
      location: role.location,
      about: role.about,
      startDate: role.startDate,
      endDate: role.endDate,
      position: role.position,
      bullets: bulletRows
        .filter((b) => b.experienceId === role.id)
        .map((b) => ({
          id: b.id,
          text: b.text,
          inBank: b.inBank,
          linkLabel: b.linkLabel,
          linkUrl: b.linkUrl,
          position: b.position,
        })),
    })),
    skillGroups: groupRows.map((group) => ({
      id: group.id,
      category: group.category,
      position: group.position,
      skills: skillRows
        .filter((s) => s.groupId === group.id)
        .map((s) => ({ id: s.id, name: s.name, position: s.position })),
    })),
    education: educationRows.map((e) => ({
      id: e.id,
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      startDate: e.startDate,
      endDate: e.endDate,
      position: e.position,
    })),
    honors: honorRows.map((h) => ({
      id: h.id,
      title: h.title,
      issuer: h.issuer,
      awardedOn: h.awardedOn,
      position: h.position,
    })),
  };
}

export async function updateProfileHeader(
  db: Database,
  profileId: string,
  input: {
    fullName: string;
    headline: string | null;
    locationLine: string | null;
    summary: string | null;
    contacts: { label: string; url: string }[];
  },
) {
  await db
    .update(profiles)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(profiles.id, profileId));
}

export async function addExperience(
  db: Database,
  profileId: string,
  input: {
    company: string;
    title: string;
    location?: string | null;
    about?: string | null;
    startDate: string;
    endDate?: string | null;
  },
) {
  const existing = await db
    .select({ position: experiences.position })
    .from(experiences)
    .where(eq(experiences.profileId, profileId));
  const nextPosition = existing.length
    ? Math.max(...existing.map((r) => r.position)) + 1
    : 0;

  const [row] = await db
    .insert(experiences)
    .values({ profileId, ...input, position: nextPosition })
    .returning();
  return row;
}

export async function addBullet(
  db: Database,
  experienceId: string,
  input: {
    text: string;
    inBank?: boolean;
    linkLabel?: string | null;
    linkUrl?: string | null;
  },
) {
  const existing = await db
    .select({ position: experienceBullets.position })
    .from(experienceBullets)
    .where(eq(experienceBullets.experienceId, experienceId));
  const nextPosition = existing.length
    ? Math.max(...existing.map((r) => r.position)) + 1
    : 0;

  const [row] = await db
    .insert(experienceBullets)
    .values({ experienceId, ...input, position: nextPosition })
    .returning();
  return row;
}

export async function addSkillGroup(
  db: Database,
  profileId: string,
  category: string,
  names: string[],
) {
  const existing = await db
    .select({ position: skillGroups.position })
    .from(skillGroups)
    .where(eq(skillGroups.profileId, profileId));
  const nextPosition = existing.length
    ? Math.max(...existing.map((r) => r.position)) + 1
    : 0;

  const [group] = await db
    .insert(skillGroups)
    .values({ profileId, category, position: nextPosition })
    .returning();

  if (names.length) {
    await db.insert(skills).values(
      names.map((name, index) => ({
        groupId: group.id,
        name,
        position: index,
      })),
    );
  }
  return group;
}

export async function deleteExperience(db: Database, experienceId: string) {
  await db.delete(experiences).where(eq(experiences.id, experienceId));
}

export async function deleteBullet(db: Database, bulletId: string) {
  await db.delete(experienceBullets).where(eq(experienceBullets.id, bulletId));
}

export async function deleteSkillGroup(db: Database, groupId: string) {
  await db.delete(skillGroups).where(eq(skillGroups.id, groupId));
}

/** Toggling a bullet in or out of the bank — the overflow inventory. */
export async function setBulletInBank(
  db: Database,
  bulletId: string,
  inBank: boolean,
) {
  await db
    .update(experienceBullets)
    .set({ inBank, updatedAt: new Date() })
    .where(eq(experienceBullets.id, bulletId));
}
