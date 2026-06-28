import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const checks = [];

check("Required frontend files exist", [
  "frontend/index.html",
  "frontend/css/styles.css",
  "frontend/js/config.js",
  "frontend/js/api.js",
  "frontend/js/auth.js",
  "frontend/js/app.js"
].every(existsSync));

check("Required Worker files exist", [
  "worker/src/index.js",
  "worker/wrangler.toml.example",
  "worker/package.json"
].every(existsSync));

check("GitHub Actions workflows exist", [
  ".github/workflows/check.yml",
  ".github/workflows/pages.yml"
].every(existsSync));

check("Git working tree is clean", getOutput("git", ["status", "--short"]) === "");
check("Git has at least one commit", getOutput("git", ["rev-parse", "--verify", "HEAD"]) !== "");
check("Git remote origin is configured", getOutput("git", ["remote", "get-url", "origin"]) !== "", "ยังไม่มี remote origin จนกว่าจะมี GitHub repo URL", false);

const config = readFileSync("frontend/js/config.js", "utf8");
check("Frontend config is safe placeholder or real URL", config.includes("PASTE_API_URL_HERE") || config.includes("https://"));

const wranglerExists = existsSync("worker/wrangler.toml");
check("Worker wrangler.toml is created", wranglerExists, "สร้างจาก worker/wrangler.toml.example ตอน deploy จริง", false);

if (wranglerExists) {
  const wrangler = readFileSync("worker/wrangler.toml", "utf8");
  check("Worker SPREADSHEET_ID looks configured", !wrangler.includes("PASTE_GOOGLE_SHEET_ID_HERE"));
  check("Worker GOOGLE_CLIENT_EMAIL looks configured", !wrangler.includes("service-account-name@project-id"));
}

let failed = 0;
for (const item of checks) {
  const icon = item.pass ? "PASS" : item.required ? "FAIL" : "WARN";
  console.log(`${icon} ${item.name}${item.note ? ` - ${item.note}` : ""}`);
  if (!item.pass && item.required) failed += 1;
}

if (failed > 0) process.exit(1);

function check(name, pass, note = "", required = true) {
  checks.push({ name, pass: Boolean(pass), note, required });
}

function getOutput(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
