"use client";

import { useEffect, useState } from "react";

const ERRORS: Record<string, string> = {
  google_denied:
    "Google declined the sign-in. If this is your app, add your Google account as a Test user in Google Cloud Console, then try again.",
  already_exists:
    "An account with this email already exists — sign in instead.",
  no_account:
    "No Cartis account found with this email — create one instead.",
};

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  const [error, setError] = useState("");
  useEffect(() => {
    setError(ERRORS[new URLSearchParams(window.location.search).get("error") ?? ""] ?? "");
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
            C
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignup
              ? "Start buying with confidence."
              : "Sign in to your Cartis account."}
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <a
          href={`/auth/start?provider=google&intent=${mode}`}
          className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
        >
          Continue with Google
        </a>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <a className="text-primary hover:underline" href="/signin">
                Sign in
              </a>
            </>
          ) : (
            <>
              New to Cartis?{" "}
              <a className="text-primary hover:underline" href="/signup">
                Create an account
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
