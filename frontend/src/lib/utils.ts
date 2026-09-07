import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(value?: string | null) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatUsdc(value?: string | number | bigint | null, decimals = 6) {
  if (value === undefined || value === null || value === "") return "0";
  const big = BigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = big / divisor;
  const fraction = big % divisor;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

export function parseUsdc(value: string, decimals = 6) {
  const cleaned = value.trim();
  if (!cleaned) throw new Error("Amount is required");
  const [wholeRaw, fractionRaw = ""] = cleaned.split(".");
  const whole = wholeRaw || "0";
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fractionRaw)) {
    throw new Error("Invalid amount");
  }
  if (fractionRaw.length > decimals) {
    throw new Error(`Use at most ${decimals} decimal places`);
  }
  const fraction = fractionRaw.padEnd(decimals, "0");
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction || "0")).toString();
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function titleCase(value?: string | null) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function csvExample() {
  return [
    "employee_name,employee_email,employee_address,net_amount,tax_amount",
    "Ada Lovelace,ada@example.com,0x4444444444444444444444444444444444444444,900.00,100.00",
  ].join("\n");
}

