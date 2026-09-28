"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getDatabase } from "@/db/client";
import { clearSessionCookie, readSession, setSessionCookie } from "@/lib/auth/cookies";
import { AuthError, logIn, revokeAllSessions, signUp } from "@/lib/auth/service";

/**
 * Server Actions for the auth screens.
 *
 * Cookies can only be written from a Server Action or Route Handler, which is
 * why session setting lives here rather than in the page components.
 */

export interface AuthFormState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  /**
   * Echoed back so the form can repopulate after a failed submit. Without this
   * the uncontrolled inputs reset on re-render and the user retypes everything
   * — and a cleared `required` field silently blocks the next submit.
   *
   * Email only. The password is never sent back to the client.
   */
  values?: { email?: string };
}

const credentials = z.object({
  email: z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email")),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(200, "That password is too long"),
});

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submittedEmail = String(formData.get("email") ?? "").trim();
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      values: { email: submittedEmail },
      fieldErrors: {
        email: flat.fieldErrors.email?.[0],
        password: flat.fieldErrors.password?.[0],
      },
    };
  }

  try {
    const { user, verificationToken } = await signUp(getDatabase(), parsed.data);
    await setSessionCookie({
      userId: user.id,
      tokenVersion: user.tokenVersion,
    });

    // No email provider is chosen yet (tech.md). Until one is, the link goes to
    // the server log so the flow is completable in development. Email
    // verification gates the first generation, not sign-in, so this does not
    // block anything else being built.
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[auth] verification link: /verify-email?token=${verificationToken}`,
      );
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.message, values: { email: submittedEmail } };
    }
    throw error;
  }

  redirect("/");
}

export async function logInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password", values: { email } };
  }

  try {
    const session = await logIn(getDatabase(), { email, password });
    await setSessionCookie(session);
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.message, values: { email } };
    }
    throw error;
  }

  redirect("/");
}

export async function logOutAction() {
  await clearSessionCookie();
  redirect("/login");
}

/** Bumps token_version, so every other device is signed out too. */
export async function logOutEverywhereAction() {
  const session = await readSession();
  if (session) await revokeAllSessions(getDatabase(), session.userId);
  await clearSessionCookie();
  redirect("/login");
}
