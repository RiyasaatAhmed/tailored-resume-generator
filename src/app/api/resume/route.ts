import { getDatabase } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getFullProfile } from "@/lib/profile/repository";
import {
  getMissingForRender,
  profileToResumeJson,
} from "@/lib/profile/to-resume-json";
import { renderResumePdf } from "@/lib/resume/render";

/**
 * `GET /api/resume` — the user's base resume as a PDF.
 *
 * Untailored: this renders the profile as entered, with no model call and no
 * cost. It is also the first time the renderer sees real user input rather
 * than a fixture, so the bullet-wrap rule gets an honest test here.
 *
 * Runs on the Node runtime (the default) because Playwright needs a real
 * Chromium binary — see ADR-0003, which is also why this cannot deploy to a
 * serverless target.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Sign in first", { status: 401 });
  }

  const profile = await getFullProfile(getDatabase(), user.id);
  if (!profile) {
    return Response.json(
      { error: "No profile yet", missing: ["a profile"] },
      { status: 409 },
    );
  }

  // A half-filled profile cannot produce a valid resume. Say which fields are
  // missing rather than rendering something broken or failing schema
  // validation with an opaque message.
  const missing = getMissingForRender(profile);
  if (missing.length > 0) {
    return Response.json(
      { error: "Profile is incomplete", missing },
      { status: 409 },
    );
  }

  const resume = profileToResumeJson(profile);
  const { pdf, wrappedBullets } = await renderResumePdf(resume);

  const filename = `${slugify(profile.fullName) || "resume"}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      // Invariant #6 is a hard rule for generated output, but this is the
      // user's own material — refusing the download would strand them. Report
      // it instead so the editor can flag the offending bullets.
      "x-wrapped-bullets": String(wrappedBullets.length),
      "cache-control": "no-store",
    },
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
