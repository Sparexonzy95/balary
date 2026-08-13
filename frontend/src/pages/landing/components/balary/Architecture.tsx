import { motion } from "framer-motion";
import { SectionHeader } from "./SectionHeader";

const PILLARS = [
  {
    eyebrow: "FROM CONTRACT SOURCES",
    title: "Smart Contract Layer",
    text: "BalaryPayrollManager coordinates institution registration, role assignment, payroll lifecycle, funding, and employee claims.",
    tags: ["Coston2 USD₮0", "BalaryPayrollManager", "Claims"],
    diagram: "contract",
  },
  {
    eyebrow: "FROM BACKEND + WORKER SOURCES",
    title: "Backend Orchestration",
    text: "Django APIs prepare transactions, validate payroll rows, track submitted hashes, send notifications, and reconcile receipts.",
    tags: ["Django", "Celery", "Notifications"],
    diagram: "system",
  },
  {
    eyebrow: "FROM ARC TESTNET CONFIG",
    title: "Coston2 USD₮0 Model",
    text: "Finance approves and funds USD₮0 on Flare Coston2 while backend state changes wait for transaction receipts.",
    tags: ["Flare Coston2", "USD₮0", "Receipts"],
    diagram: "crypto",
  },
  {
    eyebrow: "FROM FRONTEND SOURCE",
    title: "Frontend Journeys",
    text: "Institution, HR, Finance, employee claims, notifications, and account routes preserve the original premium shell.",
    tags: ["React", "Vite", "Wallet"],
    diagram: "ui",
  },
];

function Diagram({ kind }: { kind: string }) {
  if (kind === "contract")
    return (
      <svg viewBox="0 0 200 120" className="h-full w-full" fill="none">
        <rect x="20" y="20" width="60" height="32" rx="6" stroke="oklch(1 0 0 / 0.3)" />
        <rect x="120" y="20" width="60" height="32" rx="6" stroke="#FE9E15" fill="oklch(0.79 0.165 69 / 0.08)" />
        <rect x="70" y="70" width="60" height="32" rx="6" stroke="oklch(1 0 0 / 0.3)" />
        <path d="M80 52v18M120 52v18" stroke="oklch(0.79 0.165 69 / 0.5)" strokeDasharray="2 3" />
        <text x="50" y="40" textAnchor="middle" fill="oklch(0.7 0 0)" fontSize="8" fontFamily="Fira Mono">USD₮0</text>
        <text x="150" y="40" textAnchor="middle" fill="#FE9E15" fontSize="8" fontFamily="Fira Mono">Manager</text>
        <text x="100" y="90" textAnchor="middle" fill="oklch(0.7 0 0)" fontSize="8" fontFamily="Fira Mono">Claims</text>
      </svg>
    );
  if (kind === "system")
    return (
      <svg viewBox="0 0 200 120" className="h-full w-full" fill="none">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={20 + i * 60} y={50} width={40} height={20} rx={3} stroke="oklch(1 0 0 / 0.25)" />
        ))}
        <path d="M60 60h20M120 60h20" stroke="#FE9E15" />
        <circle cx="100" cy="20" r="6" stroke="#FE9E15" fill="oklch(0.79 0.165 69 / 0.15)" />
        <path d="M100 26v18" stroke="oklch(0.79 0.165 69 / 0.5)" strokeDasharray="2 2" />
        <text x="40" y="64" textAnchor="middle" fill="oklch(0.7 0 0)" fontSize="7" fontFamily="Fira Mono">API</text>
        <text x="100" y="64" textAnchor="middle" fill="#FE9E15" fontSize="7" fontFamily="Fira Mono">Worker</text>
        <text x="160" y="64" textAnchor="middle" fill="oklch(0.7 0 0)" fontSize="7" fontFamily="Fira Mono">Chain</text>
      </svg>
    );
  if (kind === "crypto")
    return (
      <svg viewBox="0 0 200 120" className="h-full w-full" fill="none">
        <circle cx="100" cy="60" r="36" stroke="oklch(0.79 0.165 69 / 0.4)" />
        <circle cx="100" cy="60" r="22" stroke="oklch(0.79 0.165 69 / 0.7)" />
        <circle cx="100" cy="60" r="8" fill="#FE9E15" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <line
            key={deg}
            x1="100"
            y1="60"
            x2={100 + Math.cos((deg * Math.PI) / 180) * 50}
            y2={60 + Math.sin((deg * Math.PI) / 180) * 50}
            stroke="oklch(1 0 0 / 0.15)"
          />
        ))}
      </svg>
    );
  // ui
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" fill="none">
      <rect x="20" y="20" width="80" height="80" rx="6" stroke="oklch(1 0 0 / 0.3)" />
      <rect x="28" y="30" width="64" height="6" rx="2" fill="oklch(0.79 0.165 69 / 0.6)" />
      <rect x="28" y="44" width="40" height="4" rx="1" fill="oklch(1 0 0 / 0.3)" />
      <rect x="28" y="54" width="50" height="4" rx="1" fill="oklch(1 0 0 / 0.2)" />
      <rect x="28" y="80" width="30" height="10" rx="2" fill="#FE9E15" />
      <rect x="115" y="30" width="65" height="70" rx="6" stroke="oklch(1 0 0 / 0.2)" />
      <rect x="123" y="40" width="48" height="4" rx="1" fill="oklch(1 0 0 / 0.25)" />
      <rect x="123" y="50" width="36" height="4" rx="1" fill="oklch(1 0 0 / 0.18)" />
      <rect x="123" y="60" width="44" height="4" rx="1" fill="oklch(1 0 0 / 0.18)" />
    </svg>
  );
}

export function Architecture() {
  return (
    <section id="architecture" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-[1440px] px-6 md:px-8">
        <SectionHeader
          eyebrow="Architecture"
          title="Built on real infrastructure."
          subtitle="Each layer is grounded in the converted Balary stack: contract manager, Django APIs, Coston2 USD₮0 configuration, and the restored premium frontend."
        />

        <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PILLARS.map((p, i) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: (i % 2) * 0.08 }}
              className="group relative overflow-hidden rounded-[24px] glass-strong grain p-7 transition-all duration-500 hover:-translate-y-1"
            >
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/8 blur-3xl transition-opacity duration-500 group-hover:bg-primary/15" />

              <div className="relative grid grid-cols-1 gap-6 md:grid-cols-5">
                <div className="md:col-span-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    {p.eyebrow}
                  </span>
                  <h3 className="mt-3 font-display text-[22px] font-semibold leading-tight text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                    {p.text}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-border bg-elevated px-2 py-1 font-mono text-[10px] text-foreground/80"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative h-32 rounded-2xl border border-border bg-background/50 p-3 md:col-span-2">
                  <div className="absolute right-2 top-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")} / 04
                  </div>
                  <Diagram kind={p.diagram} />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
