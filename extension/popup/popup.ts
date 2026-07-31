import { getSession, clearSession } from "../lib/auth.js";

const summary = document.getElementById("summary")!;
const historyEl = document.getElementById("history")!;
const logoutBtn = document.getElementById("logout") as HTMLButtonElement;

async function main(): Promise<void> {
  const sess = await getSession();
  if (!sess) {
    summary.textContent = "Not signed in.";
    return;
  }
  try {
    const res = await fetch("https://cartis-gateway.rz8m4crnwt.workers.dev/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sess.token}` },
      body: JSON.stringify({
        query: `{ me { email } walletBalance financialHealth { score } budgetAlerts { id message is_read } }`,
      }),
    });
    const data = await res.json();
    const d = data.data;
    summary.textContent = `${d.me.email} · wallet ${d.walletBalance} · health ${d.financialHealth?.score ?? "—"}`;
    for (const alert of d.budgetAlerts ?? []) {
      const div = document.createElement("div");
      div.className = "entry";
      div.textContent = alert.message;
      historyEl.appendChild(div);
    }
    logoutBtn.hidden = false;
  } catch {
    summary.textContent = "Could not reach Cartis.";
  }
}

logoutBtn.addEventListener("click", async () => {
  await clearSession();
  summary.textContent = "Not signed in.";
  logoutBtn.hidden = true;
});

void main();
