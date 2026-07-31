const STORAGE_KEY = "cartis_session";

export type Session = { token: string; expires_at: number };

export async function getSession(): Promise<Session | null> {
  const s = await chrome.storage.local.get(STORAGE_KEY);
  const sess = s[STORAGE_KEY] as Session | undefined;
  if (!sess) return null;
  if (Date.now() > sess.expires_at) {
    await clearSession();
    return null;
  }
  return sess;
}

export async function setSession(token: string, ttlMs: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: { token, expires_at: Date.now() + ttlMs } });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function refreshSession(): Promise<Session | null> {
  const sess = await getSession();
  if (!sess) return null;
  const res = await fetch("https://cartis-gateway.rz8m4crnwt.workers.dev/api/session/refresh", {
    method: "POST",
    headers: { authorization: `Bearer ${sess.token}` },
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const next = await res.json();
  await setSession(next.token, next.ttl_ms);
  return next;
}
