const rawApiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "https://zalary-api.104.237.9.230.sslip.io/api/v1";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeApiBase(value: string) {
  const normalized = stripTrailingSlash(value.trim());
  if (normalized.endsWith("/api/v1")) return normalized;
  if (normalized.endsWith("/api")) return `${normalized}/v1`;
  return `${normalized}/api/v1`;
}

function numberValue(name: string, fallback: number) {
  const raw = import.meta.env[name] as string | undefined;
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function value(name: string, fallback: string) {
  return ((import.meta.env[name] as string | undefined) || fallback).trim();
}

export const env = {
  appName: value("VITE_APP_NAME", "Balary"),
  apiBaseUrl: normalizeApiBase(rawApiBase),
  arcChainId: numberValue("VITE_COSTON2_CHAIN_ID", 114),
  arcRpcUrl: value(
    "VITE_COSTON2_RPC_URL",
    "https://coston2-api.flare.network/ext/C/rpc",
  ),
  blockExplorerUrl: stripTrailingSlash(
    value("VITE_COSTON2_EXPLORER_URL", "https://coston2-explorer.flare.network"),
  ),
  arcNativeSymbol: value("VITE_COSTON2_NATIVE_SYMBOL", "C2FLR"),
  payrollManager: value(
    "VITE_ZALARY_VAULT",
    "0xBBDDd3fFa53385c4149A0513F1E06FF36BC85020",
  ) as `0x${string}`,
  gateway: value(
    "VITE_ZALARY_GATEWAY",
    "0xf69CaAF395af6A7DeCB0ac2f86430E6c889A8216",
  ) as `0x${string}`,
  usdcToken: value(
    "VITE_ZALARY_USDT0_TOKEN",
    "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F",
  ) as `0x${string}`,
  usdcDecimals: numberValue("VITE_ZALARY_USDT0_DECIMALS", 6),
};
