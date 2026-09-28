"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import type { AuthFormState } from "./actions";

/**
 * Shared shell for sign-in and sign-up.
 *
 * `useActionState` returns [state, action, pending] — per the Next
 * authentication guide for this version.
 */
interface AuthFormProps {
  heading: string;
  submitLabel: string;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  footer: { prompt: string; href: string; linkLabel: string };
  passwordHint?: string;
  newPassword?: boolean;
}

export function AuthForm({
  heading,
  submitLabel,
  action,
  footer,
  passwordHint,
  newPassword = false,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    {},
  );

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="type-display-sm text-on-dark">{heading}</h1>

        <form action={formAction} className="mt-10 flex flex-col gap-6">
          {/*
            Form-level errors (bad credentials, email taken) are announced.
            Field-level errors live on the inputs themselves.
          */}
          {state.error ? (
            <p role="alert" className="type-caption text-danger">
              {state.error}
            </p>
          ) : null}

          <TextInput
            id="email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            disabled={pending}
            // Keyed on the echoed value so React remounts the input and picks
            // up the new defaultValue after a failed submit. Without this the
            // field resets and `required` silently blocks the next submit.
            key={state.values?.email ?? ""}
            defaultValue={state.values?.email ?? ""}
            error={state.fieldErrors?.email}
          />

          <TextInput
            id="password"
            name="password"
            type="password"
            label="Password"
            autoComplete={newPassword ? "new-password" : "current-password"}
            required
            disabled={pending}
            error={state.fieldErrors?.password}
          />

          {passwordHint && !state.fieldErrors?.password ? (
            <p className="type-caption text-muted-soft">{passwordHint}</p>
          ) : null}

          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Working" : submitLabel}
          </Button>
        </form>

        <p className="type-body-sm mt-10 text-muted">
          {footer.prompt}{" "}
          <Link href={footer.href} className="text-link underline">
            {footer.linkLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
