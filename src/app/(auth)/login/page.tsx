import type { Metadata } from "next";

import { logInAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthForm
      heading="Sign in"
      submitLabel="Sign in"
      action={logInAction}
      footer={{
        prompt: "No account yet?",
        href: "/signup",
        linkLabel: "Create one",
      }}
    />
  );
}
