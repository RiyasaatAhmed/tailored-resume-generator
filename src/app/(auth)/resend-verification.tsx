"use client";

import { useActionState } from "react";

import { resendVerificationAction } from "./actions";

type ResendState = { sent?: boolean; error?: string };

/**
 * Prompt shown while an account is unverified. `email_verified_at` gates the
 * first generation (ADR-0004), so this is not cosmetic — an unverified user
 * cannot use the product.
 */
export function ResendVerification() {
  const [state, action, pending] = useActionState<ResendState, FormData>(
    async () => resendVerificationAction(),
    {},
  );

  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <p className="type-caption text-warning">Email not confirmed</p>

      {state.sent ? (
        <p role="status" className="type-caption text-success">
          Sent — check your inbox
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="type-caption text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="type-caption text-link underline disabled:opacity-40"
      >
        {pending ? "Sending" : "Resend the link"}
      </button>
    </form>
  );
}
