import { getSession, refreshSession } from "./lib/auth.js";

const GATEWAY = "https://cartis-gateway.rz8m4crnwt.workers.dev";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create("cartis_sync", { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cartis_sync") void syncAlerts();
});

async function syncAlerts(): Promise<void> {
  const sess = await getSession();
  if (!sess) return;
  const token = (await refreshSession())?.token ?? sess.token;
  try {
    const res = await fetch(`${GATEWAY}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: `{ monthlyTab { limit spent } }`,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const t = data.data?.monthlyTab;
      const over = t && t.spent > t.limit;
      await chrome.action.setBadgeText({ text: over ? "!" : "" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    }
  } catch {
    // network hiccup; next 15-min alarm retries
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "cartis_open_login") {
    void chrome.tabs.create({ url: `${GATEWAY}/auth/start` });
  }
  sendResponse({ ok: true });
});
