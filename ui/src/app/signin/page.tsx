import type { Metadata } from "next";
import { AuthForm } from "@/components/shared/auth-form";

export const metadata: Metadata = { title: "Sign in — Cartis" };

export default function SigninPage() {
  return <AuthForm mode="signin" />;
}
