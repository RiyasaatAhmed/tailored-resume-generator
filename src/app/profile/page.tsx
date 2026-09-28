import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionHeading } from "@/components/ui/field";
import { getDatabase } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getFullProfile, getOrCreateProfile } from "@/lib/profile/repository";
import { getMissingForRender } from "@/lib/profile/to-resume-json";
import {
  deleteBulletAction,
  deleteExperienceAction,
  deleteSkillGroupAction,
  toggleBulletBankAction,
} from "./actions";
import {
  AddBulletForm,
  AddExperienceForm,
  AddSkillGroupForm,
  HeaderForm,
} from "./profile-forms";

export const metadata: Metadata = { title: "Profile" };

function formatRange(start: string, end: string | null) {
  const fmt = (d: string) =>
    new Date(`${d.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${end ? fmt(end) : "Present"}`;
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDatabase();
  await getOrCreateProfile(db, user.id);
  const profile = (await getFullProfile(db, user.id))!;
  const missing = getMissingForRender(profile);

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-hairline px-6">
        <Link href="/" className="type-nav text-muted">
          Back
        </Link>
        <Link href="/" className="type-wordmark text-on-dark">
          Tailored
        </Link>
        <span className="type-nav text-muted">Profile</span>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-6 py-16">
        {/*
          The download is the point of this page: the profile renders through
          the same Playwright path a tailored resume will, with no model call.
        */}
        <section className="flex flex-col gap-4">
          {missing.length > 0 ? (
            <p className="type-caption text-warning">
              Before you can download: add {missing.join(", ")}.
            </p>
          ) : (
            <a
              href="/api/resume"
              className="type-button self-start rounded-[9999px] border border-on-dark px-8 py-3 text-on-dark"
            >
              Download resume
            </a>
          )}
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeading>Details</SectionHeading>
          <HeaderForm profile={profile} />
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeading>Experience</SectionHeading>

          {profile.experiences.map((role) => (
            <article
              key={role.id}
              className="flex flex-col gap-4 border-b border-hairline pb-8"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h3 className="type-title-md text-on-dark">{role.title}</h3>
                  <p className="type-body-sm text-muted">
                    {role.company}
                    {role.location ? ` — ${role.location}` : ""}
                  </p>
                </div>
                <span className="type-caption whitespace-nowrap text-muted">
                  {formatRange(role.startDate, role.endDate)}
                </span>
              </div>

              {role.about ? (
                <p className="type-body-sm italic text-muted-soft">{role.about}</p>
              ) : null}

              <ul className="flex flex-col gap-2">
                {role.bullets.map((bullet) => (
                  <li key={bullet.id} className="flex items-start gap-3">
                    <span
                      className="type-body-md text-muted"
                      aria-hidden="true"
                    >
                      •
                    </span>
                    <span className="type-body-md flex-1 text-body">
                      {bullet.text}
                    </span>

                    {/*
                      Banked bullets are marked, never hidden. They are true and
                      verified — overflow inventory the rewrite may pull from —
                      not second-class content.
                    */}
                    <form action={toggleBulletBankAction}>
                      <input type="hidden" name="bulletId" value={bullet.id} />
                      <input
                        type="hidden"
                        name="inBank"
                        value={String(!bullet.inBank)}
                      />
                      <button
                        type="submit"
                        className={`type-caption whitespace-nowrap ${
                          bullet.inBank ? "text-warning" : "text-muted-soft"
                        }`}
                      >
                        {bullet.inBank ? "In bank" : "On resume"}
                      </button>
                    </form>

                    <form action={deleteBulletAction}>
                      <input type="hidden" name="bulletId" value={bullet.id} />
                      <button
                        type="submit"
                        className="type-caption text-muted-soft"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>

              <AddBulletForm experienceId={role.id} />

              <form action={deleteExperienceAction} className="self-start">
                <input type="hidden" name="experienceId" value={role.id} />
                <button type="submit" className="type-caption text-muted-soft">
                  Delete role
                </button>
              </form>
            </article>
          ))}

          <AddExperienceForm />
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeading>Skills</SectionHeading>

          {profile.skillGroups.map((group) => (
            <div key={group.id} className="flex items-baseline gap-4">
              <span className="type-caption w-32 shrink-0 text-muted">
                {group.category}
              </span>
              <span className="type-body-md flex-1 text-body">
                {group.skills.map((s) => s.name).join(", ")}
              </span>
              <form action={deleteSkillGroupAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <button type="submit" className="type-caption text-muted-soft">
                  Remove
                </button>
              </form>
            </div>
          ))}

          <AddSkillGroupForm />
        </section>
      </main>
    </>
  );
}
