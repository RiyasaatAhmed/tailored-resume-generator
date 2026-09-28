import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { plans } from "@/db/schema";
import { startTestDatabase, type TestDatabase } from "@/db/testing/container";
import { signUp } from "@/lib/auth/service";
import { resumeJsonSchema } from "@/lib/resume/schema";
import {
  addBullet,
  addExperience,
  addSkillGroup,
  getFullProfile,
  getOrCreateProfile,
  updateProfileHeader,
  type FullProfile,
} from "./repository";
import {
  getMissingForRender,
  profileToResumeJson,
  toYearMonth,
} from "./to-resume-json";

let tdb: TestDatabase;

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long!!";
  tdb = await startTestDatabase();
}, 180_000);

afterAll(async () => {
  await tdb?.stop();
});

afterEach(async () => {
  await tdb.reset();
});

async function seedUserWithProfile() {
  await tdb.db.insert(plans).values({
    code: "trial",
    name: "Trial",
    priceCents: 0,
    generationLimit: 2,
    period: "lifetime",
    dailyCap: 2,
  });
  const { user } = await signUp(tdb.db, {
    email: "casey@example.com",
    password: "a-long-enough-password",
  });
  const profile = await getOrCreateProfile(tdb.db, user.id, "Casey Ray");
  return { user, profile };
}

describe("getOrCreateProfile", () => {
  it("creates a profile on first access and reuses it after", async () => {
    const { user, profile } = await seedUserWithProfile();
    const again = await getOrCreateProfile(tdb.db, user.id, "Ignored");
    expect(again.id).toBe(profile.id);
    expect(again.fullName).toBe("Casey Ray");
  });
});

describe("getFullProfile", () => {
  it("returns null when the user has no profile", async () => {
    expect(await getFullProfile(tdb.db, crypto.randomUUID())).toBeNull();
  });

  it("returns experiences and bullets in position order", async () => {
    const { user, profile } = await seedUserWithProfile();

    const first = await addExperience(tdb.db, profile.id, {
      company: "Northwind",
      title: "Senior Engineer",
      startDate: "2023-04-01",
      endDate: null,
    });
    const second = await addExperience(tdb.db, profile.id, {
      company: "Harborline",
      title: "Engineer",
      startDate: "2020-08-01",
      endDate: "2023-03-01",
    });

    await addBullet(tdb.db, first.id, { text: "Cut latency by **48%**" });
    await addBullet(tdb.db, first.id, { text: "Shipped the reporting grid" });

    const full = await getFullProfile(tdb.db, user.id);

    expect(full?.experiences.map((e) => e.company)).toEqual([
      "Northwind",
      "Harborline",
    ]);
    expect(full?.experiences[0].position).toBe(0);
    expect(second.position).toBe(1);
    expect(full?.experiences[0].bullets.map((b) => b.text)).toEqual([
      "Cut latency by **48%**",
      "Shipped the reporting grid",
    ]);
  });

  it("nests skills under their group", async () => {
    const { user, profile } = await seedUserWithProfile();
    await addSkillGroup(tdb.db, profile.id, "Frontend", ["typescript", "react"]);
    await addSkillGroup(tdb.db, profile.id, "Testing", ["vitest"]);

    const full = await getFullProfile(tdb.db, user.id);
    expect(full?.skillGroups.map((g) => g.category)).toEqual([
      "Frontend",
      "Testing",
    ]);
    expect(full?.skillGroups[0].skills.map((s) => s.name)).toEqual([
      "typescript",
      "react",
    ]);
  });
});

describe("toYearMonth", () => {
  it("truncates a Postgres date to year-month", () => {
    expect(toYearMonth("2023-04-01")).toBe("2023-04");
  });
});

describe("profileToResumeJson", () => {
  async function buildProfile(): Promise<FullProfile> {
    const { user, profile } = await seedUserWithProfile();

    await updateProfileHeader(tdb.db, profile.id, {
      fullName: "Casey Ray",
      headline: "Senior Frontend Engineer | TypeScript",
      locationLine: "Remote-First",
      summary: "Eight years on data-dense product surfaces.",
      contacts: [{ label: "GitHub", url: "https://github.com/example" }],
    });

    const role = await addExperience(tdb.db, profile.id, {
      company: "Northwind",
      title: "Senior Engineer",
      location: "Remote",
      about: "Workforce analytics SaaS.",
      startDate: "2023-04-01",
      endDate: null,
    });

    await addBullet(tdb.db, role.id, {
      text: "Cut latency by **48%**",
      linkLabel: "View Project",
      linkUrl: "https://example.com",
    });
    await addBullet(tdb.db, role.id, { text: "Shipped the reporting grid" });
    await addBullet(tdb.db, role.id, {
      text: "Held back for space",
      inBank: true,
    });

    await addSkillGroup(tdb.db, profile.id, "Frontend", ["typescript"]);

    const full = await getFullProfile(tdb.db, user.id);
    return full!;
  }

  it("produces output that satisfies the resume_json schema", async () => {
    const resume = profileToResumeJson(await buildProfile());
    expect(() => resumeJsonSchema.parse(resume)).not.toThrow();
  });

  it("converts dates to YYYY-MM and a null end date to null", async () => {
    const resume = profileToResumeJson(await buildProfile());
    expect(resume.experience[0].start_date).toBe("2023-04");
    expect(resume.experience[0].end_date).toBeNull();
  });

  /**
   * The bank is overflow inventory the user chose to hold back. Nothing selects
   * from it until the rewrite step exists, so leaking it here would pad every
   * resume with bullets the user deliberately removed.
   */
  it("excludes banked bullets by default", async () => {
    const resume = profileToResumeJson(await buildProfile());
    expect(resume.experience[0].bullets).toEqual([
      "Cut latency by **48%**",
      "Shipped the reporting grid",
    ]);
  });

  it("includes banked bullets only when asked", async () => {
    const resume = profileToResumeJson(await buildProfile(), {
      includeBankedBullets: true,
    });
    expect(resume.experience[0].bullets).toContain("Held back for space");
  });

  // The link renders on the company line, right-aligned — never inline.
  it("lifts a bullet link onto the role", async () => {
    const resume = profileToResumeJson(await buildProfile());
    expect(resume.experience[0].link).toEqual({
      label: "View Project",
      url: "https://example.com",
    });
  });

  it("caps a role at four bullets", async () => {
    const { user, profile } = await seedUserWithProfile();
    await updateProfileHeader(tdb.db, profile.id, {
      fullName: "Casey Ray",
      headline: "Engineer",
      locationLine: null,
      summary: "A summary.",
      contacts: [],
    });
    const role = await addExperience(tdb.db, profile.id, {
      company: "Northwind",
      title: "Engineer",
      startDate: "2023-04-01",
    });
    for (const text of ["one", "two", "three", "four", "five"]) {
      await addBullet(tdb.db, role.id, { text });
    }

    const resume = profileToResumeJson((await getFullProfile(tdb.db, user.id))!);
    expect(resume.experience[0].bullets).toHaveLength(4);
    expect(() => resumeJsonSchema.parse(resume)).not.toThrow();
  });

  it("drops a skill group with no skills rather than rendering a bare label", async () => {
    const { user, profile } = await seedUserWithProfile();
    await addSkillGroup(tdb.db, profile.id, "Empty", []);

    const resume = profileToResumeJson((await getFullProfile(tdb.db, user.id))!);
    expect(resume.skill_groups).toHaveLength(0);
  });

  it("survives an empty profile", async () => {
    const { user } = await seedUserWithProfile();
    const resume = profileToResumeJson((await getFullProfile(tdb.db, user.id))!);
    expect(resume.experience).toHaveLength(0);
    expect(resume.education).toHaveLength(0);
    expect(resume.honors).toHaveLength(0);
  });
});

describe("getMissingForRender", () => {
  it("lists everything an empty profile still needs", async () => {
    const { user } = await seedUserWithProfile();
    const missing = getMissingForRender((await getFullProfile(tdb.db, user.id))!);

    expect(missing).toContain("a headline");
    expect(missing).toContain("a summary");
    expect(missing).toContain("at least one role");
  });

  it("is empty once the required fields are filled in", async () => {
    const { user, profile } = await seedUserWithProfile();
    await updateProfileHeader(tdb.db, profile.id, {
      fullName: "Casey Ray",
      headline: "Senior Engineer",
      locationLine: null,
      summary: "Eight years on data-dense product surfaces.",
      contacts: [],
    });
    const role = await addExperience(tdb.db, profile.id, {
      company: "Northwind",
      title: "Engineer",
      startDate: "2023-04-01",
    });
    await addBullet(tdb.db, role.id, { text: "Cut latency by **48%**" });

    const full = (await getFullProfile(tdb.db, user.id))!;
    expect(getMissingForRender(full)).toEqual([]);
    // And the result is then a valid resume.
    expect(() => resumeJsonSchema.parse(profileToResumeJson(full))).not.toThrow();
  });

  // A role whose only bullets are banked renders as a heading with nothing
  // under it, which reads as a bug rather than a choice.
  it("flags a role whose only bullets are in the bank", async () => {
    const { user, profile } = await seedUserWithProfile();
    await updateProfileHeader(tdb.db, profile.id, {
      fullName: "Casey Ray",
      headline: "Senior Engineer",
      locationLine: null,
      summary: "A summary.",
      contacts: [],
    });
    const role = await addExperience(tdb.db, profile.id, {
      company: "Northwind",
      title: "Engineer",
      startDate: "2023-04-01",
    });
    await addBullet(tdb.db, role.id, { text: "Held back", inBank: true });

    const missing = getMissingForRender((await getFullProfile(tdb.db, user.id))!);
    expect(missing.some((m) => m.includes("Northwind"))).toBe(true);
  });
});
