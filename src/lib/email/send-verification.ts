import "server-only";

import { getAppUrl, getMailer } from "./mailer";
import { verificationEmail } from "./templates";

/**
 * Sends a verification link.
 *
 * **Never throws.** Signup has already committed by the time this runs, and a
 * provider outage must not roll the account back or surface as a signup
 * failure — the user would retry and hit "email already registered" on an
 * account they cannot reach. A failure is logged and recoverable through the
 * resend button instead.
 */
export async function sendVerificationEmail(input: {
  to: string;
  token: string;
}): Promise<{ delivered: boolean }> {
  const verifyUrl = `${getAppUrl()}/verify-email?token=${encodeURIComponent(input.token)}`;

  try {
    await getMailer().send(verificationEmail({ to: input.to, verifyUrl }));
    return { delivered: true };
  } catch (error) {
    console.error("[email] failed to send verification email", error);
    return { delivered: false };
  }
}
