export type User = { id: string; email: string; name: string; avatar: string };

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";
const IS_DEV = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEMO_MODE === "1";

const DEMO_USER: User = {
  id: "demo-user",
  email: "preview@cartis.ai",
  name: "Aditya Sharma",
  avatar: "",
};

export async function getMe(): Promise<User | null> {
  try {
    const res = await fetch(`${GATEWAY}/auth/me`, { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { user: User };
      if (data.user) return data.user;
    }
  } catch {
    // Backend gateway unreachable
  }

  // Fallback for localhost / local dev session
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("cartis_user_session");
    if (saved) {
      try {
        return JSON.parse(saved) as User;
      } catch {
        // invalid JSON fallback
      }
    }
  }

  if (IS_DEV) {
    return DEMO_USER;
  }

  return null;
}
