import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/cookies";
import { logOutAction } from "./(auth)/actions";
import { ResendVerification } from "./(auth)/resend-verification";

/**
 * Landing surface. Reads the session so signing in is visible end to end.
 *
 * The database may not be configured yet on a fresh checkout, and a missing
 * DATABASE_URL should not 500 the landing page — so a failed lookup degrades to
 * the signed-out view rather than throwing.
 */
async function getUserOrNull() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export default async function Home() {
  const user = await getUserOrNull();

  return (
    <>
      {/* Transparent 56px nav, wordmark centred — the widest tracking in the system. */}
      <header className="flex h-14 items-center justify-between px-6">
        <span className="type-nav text-muted">Menu</span>
        <Link href="/" className="type-wordmark text-on-dark">
          Tailored
        </Link>
        <span className="type-nav text-muted">
          {user ? user.email.split("@")[0] : ""}
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
        <h1 className="type-display-lg max-w-3xl text-on-dark">
          Re-aimed for the role
        </h1>

        <p className="type-body-md max-w-md text-body">
          Tailor your resume to a posting without inventing anything. Every claim
          traces back to your own material.
        </p>

        {user ? (
          <div className="flex flex-col items-center gap-6">
            <p className="type-caption text-muted">Signed in as {user.email}</p>
            {!user.emailVerifiedAt ? <ResendVerification /> : null}
            <div className="flex items-center gap-6">
              <Link href="/profile">
                <Button type="button">Edit profile</Button>
              </Link>
              <form action={logOutAction}>
                <button type="submit" className="type-button text-muted underline">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button type="button">Create account</Button>
            </Link>
            <Link href="/login" className="type-button text-muted underline">
              Sign in
            </Link>
          </div>
        )}
      </main>

      <footer className="px-6 py-16 text-center">
        <p className="type-body-sm text-muted-soft">
          Nothing is generated yet — the pipeline is not built.
        </p>
      </footer>
    </>
  );
}
