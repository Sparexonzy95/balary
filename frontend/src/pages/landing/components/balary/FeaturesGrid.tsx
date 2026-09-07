import { motion } from "framer-motion";
import { SectionHeader } from "./SectionHeader";

const FEATURES = [
  { title: "Institution Roles", text: "Admins assign HR and Finance wallets before payroll work begins.", icon: "vault" },
  { title: "Coston2 USD₮0 Funding", text: "Finance approves and funds payroll escrow with backend-prepared payloads.", icon: "token" },
  { title: "Payroll Run Validation", text: "HR creates runs, uploads CSV rows, and validates payroll packages through Django.", icon: "calendar" },
  { title: "Event-Verified Status", text: "Submitted hashes are reconciled through backend receipt and event tracking.", icon: "prism" },
  { title: "Wallet-Native Claims", text: "Employees access claimables and submit claim transactions from connected wallets.", icon: "wallet" },
  { title: "Operational Orchestration", text: "Backend APIs, workers, and chain transaction services coordinate payroll state.", icon: "infra" },
];

function Icon({ kind }: { kind: string }) {
  const stroke = "#FE9E15";
  const fill = "oklch(0.79 0.165 69 / 0.1)";
  const cls = "h-7 w-7";
  switch (kind) {
    case "vault":
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none">
          <rect x="4" y="6" width="20" height="16" rx="3" stroke={stroke} fill={fill} />
          <circle cx="14" cy="14" r="3.5" stroke={stroke} />
          <path d="M14 10.5v-1M14 18.5v-1M10.5 14h-1M18.5 14h-1" stroke={stroke} />
        </svg>
      );
    case "token":
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none">
          <circle cx="14" cy="14" r="9" stroke={stroke} fill={fill} />
          <path d="M14 9v10M11 11.5h6M11 16.5h6" stroke={stroke} strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none">
          <rect x="4" y="6" width="20" height="18" rx="3" stroke={stroke} fill={fill} />
          <path d="M4 11h20M9 4v4M19 4v4" stroke={stroke} strokeLinecap="round" />
          <rect x="9" y="15" width="3" height="3" fill={stroke} />
        </svg>
      );
    case "prism":
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none">
          <path d="M14 4l10 18H4L14 4z" stroke={stroke} fill={fill} />
          <path d="M14 4v18M4 22l10-18 10 18" stroke={stroke} opacity="0.5" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none">
          <rect x="4" y="7" width="20" height="14" rx="3" stroke={stroke} fill={fill} />
          <path d="M4 11h20" stroke={stroke} />
          <circle cx="19" cy="16" r="1.5" fill={stroke} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none">
          <rect x="4" y="4" width="8" height="8" rx="1.5" stroke={stroke} fill={fill} />
          <rect x="16" y="4" width="8" height="8" rx="1.5" stroke={stroke} />
          <rect x="4" y="16" width="8" height="8" rx="1.5" stroke={stroke} />
          <rect x="16" y="16" width="8" height="8" rx="1.5" stroke={stroke} fill={fill} />
        </svg>
      );
  }
}

export function FeaturesGrid() {
  return (
    <section className="relative py-28 md:py-36">
      <div className="mx-auto max-w-[1440px] px-6 md:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <SectionHeader eyebrow="Capabilities" title="What Balary does." />
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            06 product surfaces
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[24px] border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
              className="group relative bg-background p-8 transition-colors hover:bg-elevated"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-elevated transition-all group-hover:border-primary/40 group-hover:bg-primary/5">
                  <Icon kind={f.icon} />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="font-display text-[16px] font-semibold leading-snug text-foreground">
                {f.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                {f.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
