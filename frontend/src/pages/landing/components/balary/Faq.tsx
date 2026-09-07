import { useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

const CATEGORIES = ["General", "Payroll", "Security", "Notifications"] as const;
type Category = (typeof CATEGORIES)[number];

const FAQS: { category: Category; q: string; a: string }[] = [
  {
    category: "General",
    q: "Why does Balary use Midnight?",
    a: "Payroll contains sensitive salary relationships that should not become public blockchain data. Midnight gives Balary shielded assets and private contract logic while keeping settlement verifiable.",
  },
  {
    category: "General",
    q: "What is zUSDM?",
    a: "zUSDM is Balary's shielded 1:1 representation of USDM already locked in the Gateway. It is not an independent economic stablecoin.",
  },
  {
    category: "General",
    q: "What is Balary's core guarantee?",
    a: "Every redeemable zUSDM is backed 1:1 by USDM locked in the Balary Gateway: locked USDM equals outstanding redeemable zUSDM.",
  },
  {
    category: "General",
    q: "Is Balary already working?",
    a: "Yes. The full lifecycle has been proven on Midnight Preview using Preview USDM: deposit, zUSDM mint, HR approval, Finance funding, salary claim, and redemption.",
  },

  {
    category: "Payroll",
    q: "Who approves salaries?",
    a: "HR privately approves the exact salary intent. Finance cannot substitute a different amount; it can fund only the exact HR-approved allocation.",
  },
  {
    category: "Payroll",
    q: "How does an employee claim?",
    a: "The employee uses private entitlement material and Merkle membership to claim the dedicated shielded salary coin. A claim nullifier prevents the same allocation from being claimed twice.",
  },
  {
    category: "Payroll",
    q: "When does a payroll become active?",
    a: "A PayrollVault starts in FUNDING and activates only after the expected approved allocations are fully funded.",
  },
  {
    category: "Payroll",
    q: "How does redemption work?",
    a: "The employee sends zUSDM to the Gateway for burning. The Gateway then releases the same amount of public USDM, preserving the 1:1 reserve invariant.",
  },

  {
    category: "Security",
    q: "Does Balary publish employee salaries?",
    a: "No. The protocol avoids a public employee-to-salary map. Salary allocations are represented by blinded commitments and Merkle membership data.",
  },
  {
    category: "Security",
    q: "How are institutional roles authenticated?",
    a: "Admin, HR, and Finance authorization is based on private secret-derived authority commitments. Balary does not use ownPublicKey() as institutional authentication.",
  },
  {
    category: "Security",
    q: "What prevents double claims?",
    a: "Domain-separated claim nullifiers make each valid salary allocation settle only once.",
  },
  {
    category: "Security",
    q: "Where does privacy end?",
    a: "Privacy intentionally ends when zUSDM is redeemed to public USDM. Public settlement is a deliberate boundary of the protocol.",
  },

  {
    category: "Notifications",
    q: "What can judges verify today?",
    a: "The public repository contains compiling Compact contracts, 32 architecture and security checks, 42 protocol-model tests, and exact Midnight Preview transaction evidence.",
  },
  {
    category: "Notifications",
    q: "Was a separate employee wallet tested?",
    a: "Yes locally. The final Preview claim replay used the same funded wallet for both roles because a newly created Preview employee wallet needed time to accumulate tDUST.",
  },
  {
    category: "Notifications",
    q: "Is Balary on mainnet?",
    a: "Not yet. The protocol is proven on Midnight Preview. The next waves focus on product UX, traction, community adoption, security hardening, and the path toward mainnet.",
  },
  {
    category: "Notifications",
    q: "Where can I inspect the evidence?",
    a: "Open the GitHub repository or the live demo replay. Both link the proven Gateway, PayrollVault, deposit, funding, claim, and redemption evidence.",
  },
];

export function Faq() {
  const [activeCategory, setActiveCategory] = useState<Category>("General");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const filtered = FAQS.filter((f) => f.category === activeCategory);

  /* ────────────────
     MAGNETIC SYSTEM
  ──────────────── */
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 120, damping: 20 });
  const springY = useSpring(y, { stiffness: 120, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;

    x.set(relX * 0.05);
    y.set(relY * 0.05);
  };

  return (
    <section className="relative py-20 sm:py-24 bg-[#1c1c1c] overflow-hidden">
      {/* dark ambient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[60vh] w-[45vw] bg-black/50 blur-[160px]" />
        <div className="absolute bottom-0 left-[-10%] h-[40vh] w-[35vw] bg-black/40 blur-[140px]" />
      </div>

      <motion.div
        className="mx-auto w-full max-w-[820px] min-w-0 px-4"
        onMouseMove={handleMouseMove}
        initial={{ opacity: 0, scale: 0.97, y: 30 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* HEADER */}
        <div className="text-center mb-12 max-[320px]:mb-10">
          <h2 className="text-3xl max-[320px]:text-[27px] font-semibold text-white tracking-tight leading-[1.08]">
            Frequently Asked Questions
          </h2>
        </div>

        {/* CATEGORY FILTER */}
        <div className="flex justify-center mb-10 max-[375px]:px-1 max-[320px]:w-full max-[320px]:mb-9">
          <div className="flex rounded-full bg-white/[0.04] border border-white/10 p-1 backdrop-blur-md max-[375px]:max-w-full max-[320px]:grid max-[320px]:w-full max-[320px]:max-w-[22rem] max-[320px]:grid-cols-2 max-[320px]:gap-1 max-[320px]:rounded-[14px]">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setOpenQuestion(null);
                  }}
                  className="relative px-4 py-1.5 text-[11px] uppercase tracking-widest max-[375px]:px-2.5 max-[375px]:text-[10px] max-[375px]:tracking-[0.1em] max-[320px]:min-w-0 max-[320px]:rounded-[10px] max-[320px]:px-2.5 max-[320px]:py-2 max-[320px]:text-[10px] max-[320px]:tracking-[0.12em]"
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 rounded-full bg-white/10 border border-white/15"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}

                  <span
                    className={`relative z-10 transition max-[320px]:block max-[320px]:min-w-0 max-[320px]:truncate ${isActive ? "text-white" : "text-white/45"
                      }`}
                  >
                    {cat}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ LIST */}
        <div className="min-w-0 space-y-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-w-0 space-y-3"
            >
              {filtered.map((faq) => {
                const isOpen = openQuestion === faq.q;

                const rotateX = useTransform(y, [-50, 50], [6, -6]);
                const rotateY = useTransform(x, [-50, 50], [-6, 6]);

                return (
                  <motion.div
                    key={faq.q}
                    layout
                    style={{
                      rotateX,
                      rotateY,
                      transformPerspective: 900,
                    }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 200, damping: 22 }}
                    className="
    relative
    min-w-0
    rounded-[3px]
    border border-white/10
    bg-white/[0.03]
    overflow-hidden
  "
                  >
                    {/* QUESTION */}
                    <button
                      onClick={() =>
                        setOpenQuestion(isOpen ? null : faq.q)
                      }
                      className="w-full min-w-0 flex items-start justify-between gap-4 px-5 py-5 text-left"
                    >
                      <span className="min-w-0 text-white/80 leading-snug">{faq.q}</span>
                      <span className="shrink-0 text-white/40">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    {/* ANSWER */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 120,
                            damping: 22,
                          }}
                          className="px-5 pb-5 text-sm text-white/60 leading-relaxed"
                        >
                          {faq.a}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* magnetic layer */}
                    <motion.div
                      style={{ x: springX, y: springY }}
                      className="absolute inset-0 pointer-events-none"
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
}
