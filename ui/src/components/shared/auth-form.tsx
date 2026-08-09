"use client";

import { SigninForm } from "@/components/ui/signin-form";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  return <SigninForm defaultMode={mode} />;
}
