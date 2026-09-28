/**
 * Outbound email, behind an interface.
 *
 * `tech.md` lists email as an external service with no provider chosen; Resend
 * is the choice, and it lives in one adapter so swapping it later touches this
 * file only. Development uses the console transport, so the flow is completable
 * without an account or a verified domain.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

/** Writes the message to the server log. The default outside production. */
export const consoleMailer: Mailer = {
  async send({ to, subject, text }) {
    console.info(`\n[email] to=${to}\n[email] subject=${subject}\n${text}\n`);
  },
};

export function createResendMailer(apiKey: string, from: string): Mailer {
  return {
    async send({ to, subject, text, html }) {
      // Imported lazily so the SDK never loads in development or tests.
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      const { error } = await resend.emails.send({
        from,
        to,
        subject,
        text,
        html,
      });

      // The SDK reports failures in the response rather than throwing.
      if (error) {
        throw new Error(`Resend refused the message: ${error.message}`);
      }
    },
  };
}

let cached: Mailer | undefined;

/**
 * Resend when configured, console otherwise.
 *
 * Deliberately falls back rather than throwing: a missing key in development
 * should log the link, not break signup.
 */
export function getMailer(): Mailer {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    cached = createResendMailer(apiKey, from);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[email] RESEND_API_KEY or EMAIL_FROM is unset — falling back to the console transport. No mail will be delivered.",
      );
    }
    cached = consoleMailer;
  }

  return cached;
}

/** Test seam. */
export function setMailer(mailer: Mailer | undefined) {
  cached = mailer;
}

/**
 * The origin links in emails are built from.
 *
 * A relative link is useless in an inbox, so this has to be absolute and
 * correct per environment.
 */
export function getAppUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
