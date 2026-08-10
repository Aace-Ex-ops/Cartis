import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";

const out = "dist-firefox";

rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/popup`, { recursive: true });
mkdirSync(`${out}/icons`, { recursive: true });

build({
  entryPoints: {
    background: "background.ts",
    content: "content_script.ts",
    "popup/popup": "popup/popup.ts",
  },
  outdir: out,
  bundle: true,
  format: "iife",
  target: "firefox120",
  logLevel: "info",
  banner: { js: "var chrome = globalThis.browser ?? globalThis.chrome;" },
}).catch(() => process.exit(1));

cpSync("popup/popup.html", `${out}/popup/popup.html`);
cpSync("manifest-firefox.json", `${out}/manifest.json`);
cpSync("icons", `${out}/icons`, { recursive: true });

const popupHtml = readFileSync(`${out}/popup/popup.html`, "utf8");
writeFileSync(`${out}/popup/popup.html`, popupHtml.replace("popup.ts", "popup.js"));