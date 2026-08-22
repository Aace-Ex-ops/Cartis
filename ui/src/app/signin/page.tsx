import type { Metadata } from "next";
import { AuthUI } from "@/components/ui/auth-ui";

export const metadata: Metadata = { title: "Sign in — Cartis" };

export default function SigninPage() {
  return <AuthUI defaultMode="signin" />;
}