import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getDatabase } from "@/db/client";
import { AuthError, verifyEmail } from "@/lib/auth/service";

export const metadata: Metadata = { title: "Confirm your email" };

/**
 * `/verify-email?token=...`
 *
 * Consuming the token during render is safe here only because this page is
 * always dynamic: it reads `searchParams`, so Next never prerenders or caches
 * it, and no link prefetch can burn the token — nothing links to it internally,
 * it is only ever reached from the email.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let state: "ok" | "invalid" | "missing" = "missing";

  if (token) {
    try {
      await verifyEmail(getDatabase(), token);
      state = "ok";
    } catch (error) {
      if (error instanceof AuthError) state = "invalid";
      else throw error;
    }
  }

  const copy = {
    ok: {
      heading: "Email confirmed",
      body: "You can generate resumes now.",
    },
    invalid: {
      heading: "That link didn't work",
      body: "It may have expired, already been used, or been replaced by a newer one. Sign in and request another.",
    },
    missing: {
      heading: "Nothing to confirm",
      body: "This link is missing its token. Open the link from your email directly.",
    },
  }[state];

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="type-display-sm text-on-dark">{copy.heading}</h1>
        <p className="type-body-md text-body">{copy.body}</p>
        <Link href="/" className="self-start">
          <Button type="button">Continue</Button>
        </Link>
      </div>
    </main>
  );
}
