import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  containerVariant,
  containerFast,
  fadeUpVariant,
  fadeLeftVariant,
  fadeRightVariant,
  itemVariant,
  VP,
} from "../../lib/animations";

const EMPLOYER_IMAGE =
  "https://res.cloudinary.com/durncdjje/image/upload/v1780077284/emp_1_lib370.avif";
const EMPLOYEE_IMAGE =
  "https://res.cloudinary.com/durncdjje/image/upload/v1780077259/empeee_2_udbnpq.avif";

function FeatureBlock({
  eyebrow,
  title,
  subtitle,
  features,
  cta,
  image,
  reverse = false,
  id,
  bg,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: string[];
  cta: string;
  image: string;
  reverse?: boolean;
  id: string;
  bg: string;
}) {
  const copyVariant = reverse ? fadeRightVariant : fadeLeftVariant;
  const imageVariant = reverse ? fadeLeftVariant : fadeRightVariant;

  return (
    <section id={id} style={{ backgroundColor: bg }} className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div
          className={[
            "flex flex-col gap-10 sm:gap-12 lg:flex-row lg:items-center lg:gap-16",
            reverse ? "lg:flex-row-reverse" : "",
          ].join(" ")}
        >
          {/* Copy column */}
          <motion.div
            variants={copyVariant}
            initial="hidden"
            whileInView="visible"
            viewport={VP}
            className="flex-1"
          >
            <motion.div variants={containerVariant}>
              <motion.span
                variants={itemVariant}
                className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-primary"
              >
                {eyebrow}
              </motion.span>

              <motion.h2
                variants={fadeUpVariant}
                className="mt-4 font-display text-[22px] sm:text-[28px] md:text-[36px] font-bold leading-[1.1] tracking-[-0.025em] text-foreground"
              >
                {title}
              </motion.h2>

              {subtitle && (
                <motion.p
                  variants={itemVariant}
                  className="mt-4 text-[15px] leading-relaxed text-muted-foreground"
                >
                  {subtitle}
                </motion.p>
              )}

              <motion.ul variants={containerFast} className="mt-8 space-y-2.5">
                {features.map((feature) => (
                  <motion.li
                    key={feature}
                    variants={itemVariant}
                    className="flex items-center gap-3 text-[14px] text-foreground/70"
                  >
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    {feature}
                  </motion.li>
                ))}
              </motion.ul>

              <motion.div variants={itemVariant} className="mt-8">
                <Link
                  to="/app"
                  className="decrypt-hover-btn inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85 active:opacity-75"
                >
                  {cta}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6h7m0 0L6 2.5M9.5 6L6 9.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Image column */}
          <motion.div
            variants={imageVariant}
            initial="hidden"
            whileInView="visible"
            viewport={VP}
            className="flex-[1.4]"
          >
            <img
              src={image}
              alt={`${title} preview`}
              className="block w-full object-contain"
              width={1920}
              height={1080}
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function EmployerSection() {
  return (
    <FeatureBlock
      id="employers"
      bg="oklch(0.20 0 0)"
      eyebrow="For confidential payroll workflows"
      title="A foundation for private applications built around payroll."
      subtitle=""
      features={[
        "Protect sensitive payroll inputs before execution",
        "Run payroll logic through a confidential compute boundary",
        "Generate verified outputs for settlement workflows",
        "Keep role-based controls for HR, Finance, and institutions",
        "Track proofs, receipts, and status without exposing sensitive data",
      ]}
      cta="Open workspace"
      image={EMPLOYER_IMAGE}
    />
  );
}

export function EmployeeSection() {
  return (
    <FeatureBlock
      id="employees"
      bg="oklch(0.175 0 0)"
      reverse
      eyebrow="For confidential settlement"
      title="Sensitive outputs remain verifiable while private data stays protected."
      subtitle=""
      features={[
        "Review claimable payouts without exposing private payroll internals",
        "Submit verified claim transactions from the wallet you control",
        "Follow settlement status through receipt-backed confirmation",
        "Receive updates tied to trusted execution results",
        "Demonstrate how private business logic can still connect to public systems",
      ]}
      cta="View employee claims"
      image={EMPLOYEE_IMAGE}
    />
  );
}
