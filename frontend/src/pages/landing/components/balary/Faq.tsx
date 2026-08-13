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
    q: "Why does Balary need Confidential Compute?",
    a: "Payroll contains sensitive financial information that should not be exposed publicly. Confidential Compute allows Balary to process this information privately while still producing verifiable outputs that interact with blockchain systems.",
  },
  {
    category: "General",
    q: "What makes Balary different from a normal payroll app?",
    a: "Balary is a confidential application pattern: private payroll logic runs in a Trusted Execution Environment, while verified results connect back into on-chain settlement and claim workflows.",
  },
  {
    category: "General",
    q: "How does Balary fit into an existing workflow?",
    a: "Institutions keep their operational process while using Balary to secure sensitive payroll execution, validate results, and connect those results to blockchain settlement flows.",
  },
  {
    category: "General",
    q: "Is Balary only for crypto-native teams?",
    a: "No. The application demonstrates a broader confidential compute pattern that any institution can evaluate for sensitive workflows beyond payroll.",
  },

  {
    category: "Payroll",
    q: "What runs inside the TEE?",
    a: "Sensitive payroll computation logic runs inside the Trusted Execution Environment, including protected processing of payroll inputs before verified results are returned to on-chain workflows.",
  },
  {
    category: "Payroll",
    q: "How are payroll funds managed?",
    a: "Finance approves USD₮0 and funds the payroll escrow through backend-prepared BalaryPayrollManager transactions.",
  },
  {
    category: "Payroll",
    q: "Who uploads payroll rows?",
    a: "HR creates a payroll run, uploads CSV rows, validates them through Django, and prepares the package before Finance funds it.",
  },
  {
    category: "Payroll",
    q: "Are payouts instant?",
    a: "Payout timing depends on Flare Coston2 transaction inclusion and backend receipt tracking.",
  },

  {
    category: "Security",
    q: "How secure is Balary?",
    a: "The frontend asks the backend to prepare contract calls, then the connected wallet signs and submits them on Flare Coston2.",
  },
  {
    category: "Security",
    q: "Is the payroll process fully onchain?",
    a: "Contract actions are submitted on-chain, while Django tracks payroll state, transaction hashes, and notifications.",
  },
  {
    category: "Security",
    q: "What prevents errors in payroll execution?",
    a: "CSV validation, role checks, backend-prepared payloads, and receipt matching reduce frontend-side assumptions.",
  },
  {
    category: "Security",
    q: "Can transactions be verified without exposing data?",
    a: "Balary verifies submitted hashes through backend transaction tracking and chain event checks.",
  },

  {
    category: "Notifications",
    q: "Can Balary send email updates?",
    a: "Yes. Notification preferences support email updates alongside in-app notices.",
  },
  {
    category: "Notifications",
    q: "What gets tracked in-app?",
    a: "Payroll updates, claim updates, transaction status changes, and security-relevant messages can appear in the notifications workspace.",
  },
  {
    category: "Notifications",
    q: "Who receives claim updates?",
    a: "Employees can receive claim-related updates for payroll rows connected to their wallet and configured email preferences.",
  },
  {
    category: "Notifications",
    q: "Are frontend actions final immediately?",
    a: "No. The frontend submits transactions, and final status comes from backend receipt and event tracking.",
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
