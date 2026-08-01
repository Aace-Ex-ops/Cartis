"use client";

import { useState, type FormEvent } from "react";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup ? { email, password, name } : { email, password },
        ),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary/60";

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

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {isSignup && (
            <input
              className={input}
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          )}
          <input
            className={input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className={input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          {isSignup && (
            <p className="text-[12px] text-muted-foreground">
              Minimum 8 characters. No emails, no spam — promise.
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "One sec…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

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

        <div className="my-6 flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="h-px flex-1 bg-border/60" />
          or
          <span className="h-px flex-1 bg-border/60" />
        </div>

        <a
          href="/auth/login?provider=google"
          className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
        >
          Continue with Google
        </a>
      </div>
    </div>
  );
}
