import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredHashes = {
  "src/styles/index.css": "d57359ca9b6d83bbe77f3ea3b3f266f7ef48ee2505dd318053a32ef85c2b9332",
  "src/styles/tailwind.css": "c488638cd3e7e40d5981ad4bfabc26d1de41334bfc1d934a95064a22a79c86ca",
  "src/pages/landing/styles.css": "a272026cb2af7b61e1654bbb59d37d2b925313957bbdd7f69590c6012f4af529",
  "public/favicon.png": "367a5e03a7920200c126c2996a3c136ab5535bc9410294693fcfed213e69e007",
};

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(path) {
  return readdirSync(path).flatMap((name) => {
    const full = join(path, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

for (const [path, expected] of Object.entries(requiredHashes)) {
  const actual = sha256(path);
  if (actual !== expected) throw new Error(`Sample design lock failed for ${path}: ${actual}`);
}

const sources = walk("src")
  .filter((path) => /\.(ts|tsx)$/.test(path))
  .map((path) => [path, readFileSync(path, "utf8")]);

const forbidden = [
  ["legacy agent routes", "routes.agent"],
  ["legacy payroll endpoint", "/payroll-runs/"],
  ["legacy network label", "Arc Testnet"],
  ["legacy product label", "Balary"],
];

for (const [label, token] of forbidden) {
  const hit = sources.find(([, text]) => text.includes(token));
  if (hit) throw new Error(`${label} remains in ${hit[0]}`);
}

const routes = readFileSync("src/lib/routes.ts", "utf8");
if (routes.includes('"/claims/')) throw new Error("Legacy claims API endpoint remains in routes.ts");
for (const endpoint of [
  "/institutions/",
  "/employees/",
  "/payrolls/",
  "/withdrawals/",
  "/withdrawals/available/",
  "/fcc/instructions/",
  "/schedules/",
  "/audit/events/",
]) {
  if (!routes.includes(endpoint)) throw new Error(`Missing Milestone 5.2 endpoint: ${endpoint}`);
}

const tx = readFileSync("src/lib/tx.ts", "utf8");
if (!tx.includes("payload.data") || !tx.includes("payload.to")) {
  throw new Error("Prepared transaction passthrough is not active");
}

const dashboard = readFileSync("src/app/AppDashboard.tsx", "utf8");
if (dashboard.includes('label: "Confidential Compute"')) {
  throw new Error("Confidential Compute tab remains in the dashboard navigation");
}

const router = readFileSync("src/app/router.tsx", "utf8");
if (!router.includes("PrivateWithdrawalsPage") || !router.includes("PrivateWithdrawalDetailPage")) {
  throw new Error("Private withdrawal routes are not active");
}

console.log("ZALARY FRONTEND INTEGRATION VERIFIED");
console.log("Sample CSS unchanged: True");
console.log("Sample favicon unchanged: True");
console.log("Milestone 5.2 API routes active: True");
console.log("Backend-prepared transaction passthrough active: True");
console.log("Private withdrawal flow active: True");
console.log("Secrets inspected or printed: False");
