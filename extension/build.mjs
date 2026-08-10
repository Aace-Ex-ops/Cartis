import { build } from "esbuild";

build({
  entryPoints: {
    background: "background.ts",
    content: "content_script.ts",
    "popup/popup": "popup/popup.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome120",
  logLevel: "info",
}).catch(() => process.exit(1));
