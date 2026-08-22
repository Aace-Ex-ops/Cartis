import type { Metadata } from "next";
import { AuthUI } from "@/components/ui/auth-ui";

export const metadata: Metadata = { title: "Sign up — Cartis" };

export default function SignupPage() {
  return <AuthUI defaultMode="signup" />;
}