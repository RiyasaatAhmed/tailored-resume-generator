import type { Metadata } from "next";

import { signUpAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <AuthForm
      heading="Create account"
      submitLabel="Create account"
      action={signUpAction}
      newPassword
      passwordHint="At least 12 characters."
      footer={{
        prompt: "Already have an account?",
        href: "/login",
        linkLabel: "Sign in",
      }}
    />
  );
}
