"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDatabase } from "@/db/client";
import {
  clearSessionCookie,
  getCurrentUser,
  readSession,
  setSessionCookie,
} from "@/lib/auth/cookies";
import {
  AuthError,
  issueVerificationToken,
  logIn,
  revokeAllSessions,
  signUp,
} from "@/lib/auth/service";
import { sendVerificationEmail } from "@/lib/email/send-verification";

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

    // Sending never throws — signup has already committed, and a provider
    // outage must not surface as a failed signup on an account the user then
    // cannot re-create. The resend button is the recovery path.
    await sendVerificationEmail({ to: user.email, token: verificationToken });
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

/**
 * Re-sends the verification link.
 *
 * Throttled per user. Without a limit this is an open relay pointed at any
 * address someone can sign up with, and it burns the provider's send quota.
 * In-memory is enough for a single long-running Node host (ADR-0003); move it
 * to Postgres if the worker is ever split out.
 */
const RESEND_COOLDOWN_MS = 60_000;
const lastResendAt = new Map<string, number>();

export async function resendVerificationAction(): Promise<{
  sent?: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first" };
  if (user.emailVerifiedAt) return { error: "Your email is already confirmed" };

  const previous = lastResendAt.get(user.id) ?? 0;
  const waitMs = RESEND_COOLDOWN_MS - (Date.now() - previous);
  if (waitMs > 0) {
    return {
      error: `Wait ${Math.ceil(waitMs / 1000)}s before requesting another`,
    };
  }
  lastResendAt.set(user.id, Date.now());

  const token = await issueVerificationToken(getDatabase(), user.id);
  if (!token) return { error: "Your email is already confirmed" };

  await sendVerificationEmail({ to: user.email, token });
  revalidatePath("/");
  return { sent: true };
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
