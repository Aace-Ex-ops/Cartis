import type { Metadata } from "next";
import { AuthForm } from "@/components/shared/auth-form";

export const metadata: Metadata = { title: "Sign up — Cartis" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
