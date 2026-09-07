import { motion } from "framer-motion";
import { useState } from "react";
import { SectionHeader } from "./SectionHeader";

const CARDS = [
  {
    title: "Role Coordination",
    text: "Keep institution admins, HR operators, Finance wallets, and employees in one accountable workflow.",
    glyph: "shield",
  },
  {
    title: "On-chain Coordination",
    text: "Payroll, funding, claims, and notifications are structured into a real operational workflow.",
    glyph: "flow",
  },
  {
    title: "Employee Self-Service",
    text: "Employees discover claimable runs, request claims, and finalize payouts through wallet-native flows.",
    glyph: "user",
  },
  {
    title: "Receipt Assurance",
    text: "Backend receipt checks and event tracking keep status changes tied to submitted hashes.",
    glyph: "cube",
  },
];

function Glyph({ kind }: { kind: string }) {
  const stroke = "oklch(0.55 0 0)";
  if (kind === "shield")
    return (
      <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" aria-hidden>
        <path d="M24 5l14 5v11c0 8-5.5 13-14 16C10 34 9 29 9 21V10L24 5z" stroke={stroke} strokeWidth="0.6" strokeLinejoin="round" />
        <path d="M17 25l5 5 9-10" stroke={stroke} strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "flow")
    return (
      <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="4.5" stroke={stroke} strokeWidth="0.6" />
        <circle cx="38" cy="10" r="4.5" stroke={stroke} strokeWidth="0.6" />
        <circle cx="24" cy="24" r="5" stroke={stroke} strokeWidth="0.6" />
        <circle cx="38" cy="38" r="4.5" stroke={stroke} strokeWidth="0.6" />
        <path d="M13.5 12.5l7.5 8M34.5 12.5l-7.5 8M34.5 35.5l-7.5-8" stroke={stroke} strokeWidth="1" strokeOpacity="0.4" />
      </svg>
    );
  if (kind === "user")
    return (
      <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" aria-hidden>
        <circle cx="24" cy="16" r="7" stroke={stroke} strokeWidth="0.6" />
        <path d="M8 40c0-8 7-13 16-13s16 5 16 13" stroke={stroke} strokeWidth="0.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" aria-hidden>
      <path d="M24 4l18 9.5v21L24 44 6 34.5v-21L24 4z" stroke={stroke} strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M6 13.5l18 9.5 18-9.5M24 23v21" stroke={stroke} strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

export function ProblemValue() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="product" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-[1440px] px-6 md:px-8">
        <SectionHeader
          eyebrow="Why Balary"
          title={
            <>
              Payroll needs coordination.
              <br />
              <span className="text-muted-foreground">Wallet workflows need structure.</span>
            </>
          }
          subtitle="Balary connects institution registration, HR validation, Finance funding, employee self-claims, and backend event tracking inside one premium workspace."
        />

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c, i) => {
            const isHovered = hovered === i;
            const isDimmed = hovered !== null && !isHovered;

            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.25 }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                animate={{
                  scale: isHovered ? 1.04 : isDimmed ? 0.97 : 1,
                  filter: isDimmed ? "blur(2px)" : "blur(0px)",
                  opacity: isDimmed ? 0.5 : 1,
                }}
                onHoverStart={() => setHovered(i)}
                onHoverEnd={() => setHovered(null)}
                style={{ transformOrigin: "center center" }}
                className="flex flex-col overflow-hidden border border-white/[0.07] cursor-default"
              >
                {/* Top — icon fills entire section */}
                <motion.div
                  animate={{ backgroundColor: isHovered ? "oklch(0.19 0 0)" : "oklch(0.12 0 0)" }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative h-56 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />
                  <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: false, amount: 0.3 }}
                    animate={{ scale: isHovered ? 1.08 : 1 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute -inset-10"
                  >
                    <Glyph kind={c.glyph} />
                  </motion.div>
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]" />
                </motion.div>

                {/* Bottom — content area */}
                <div className="flex flex-1 flex-col px-6 pb-7 pt-20">
                  <h3 className="text-[15px] font-semibold leading-snug text-foreground">
                    {c.title}
                  </h3>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
                    {c.text}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
