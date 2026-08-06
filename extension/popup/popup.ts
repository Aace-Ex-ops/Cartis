import { getSession, refreshSession, clearSession } from "../lib/auth.js";

const GATEWAY = "https://cartis-gateway.rz8m4crnwt.workers.dev";

const summary = document.getElementById("summary")!;
const signInBtn = document.getElementById("signin") as HTMLButtonElement;
const logoutBtn = document.getElementById("logout") as HTMLButtonElement;

async function main(): Promise<void> {
  let sess = await getSession();
  if (!sess) sess = await refreshSession();
  if (!sess) {
    summary.textContent = "Not signed in.";
    signInBtn.hidden = false;
    return;
  }
  try {
    const res = await fetch(`${GATEWAY}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sess.token}` },
      body: JSON.stringify({
        query: `{ me { email } wallet { balance tabLimit } monthlyTab { limit spent } }`,
      }),
    });
    const data = await res.json();
    const d = data.data;
    summary.textContent = `${d.me.email} · wallet ₹${d.wallet.balance} · tab ${d.monthlyTab.spent}/${d.monthlyTab.limit}`;
    logoutBtn.hidden = false;
  } catch {
    summary.textContent = "Could not reach Cartis.";
  }
}

signInBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: `${GATEWAY}/auth/start` });
});

logoutBtn.addEventListener("click", async () => {
  await clearSession();
  summary.textContent = "Not signed in.";
  signInBtn.hidden = false;
  logoutBtn.hidden = true;
});

void main();
