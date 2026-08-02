export type User = { id: string; email: string; name: string; avatar: string };

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

export async function getMe(): Promise<User | null> {
  try {
    const res = await fetch(`${GATEWAY}/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: User };
    return data.user;
  } catch {
    return null;
  }
}
