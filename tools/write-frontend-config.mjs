import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiBaseUrl = process.env.API_BASE_URL || "PASTE_API_URL_HERE";
const demoModeValue = process.env.DEMO_MODE ?? "auto";
const demoMode = demoModeValue === "true" ? true : demoModeValue === "false" ? false : "auto";

if (demoMode === false && apiBaseUrl.includes("PASTE_")) {
  console.error("DEMO_MODE=false requires API_BASE_URL to be set.");
  process.exit(1);
}

const config = `window.AppConfig = {
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  demoMode: ${JSON.stringify(demoMode)}
};
`;

writeFileSync(join(root, "frontend/js/config.js"), config);
console.log(`Wrote frontend config for ${apiBaseUrl}`);
