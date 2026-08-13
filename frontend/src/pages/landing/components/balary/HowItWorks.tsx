import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef } from "react";
import {
  containerVariant,
  itemVariant,
  VP,
} from "../../lib/animations";

const STEPS = [
  {
    title: "Register institution",
    body: "Admins register the institution, treasury wallet, tax vault, and active payroll roles.",
    surface: "#111113",
    media: "#171719",
    image:
      "https://res.cloudinary.com/dxmdwvmxl/image/upload/v1777032757/step1_-_deposit_hzn0oy.png",
  },
  {
    title: "Upload payroll rows",
    body: "HR uploads CSV payroll rows and asks Django to validate employees, amounts, and claim data.",
    surface: "#141416",
    media: "#1A1A1D",
    image:
      "https://res.cloudinary.com/dxmdwvmxl/image/upload/v1777032757/step_5_employee_request_xbwshc.png",
  },
  {
    title: "Prepare payroll package",
    body: "The backend builds the payroll package and prepares the exact contract payload for the wallet.",
    surface: "#101214",
    media: "#171A1D",
    image:
      "https://res.cloudinary.com/dxmdwvmxl/image/upload/v1777032756/step_3_create_payrolls_liowmr.png",
  },
  {
    title: "Fund with Coston2 USD₮0",
    body: "Finance approves USD₮0, funds payroll escrow, and records the submitted hash for event tracking.",
    surface: "#151312",
    media: "#1B1815",
    image:
      "https://res.cloudinary.com/dxmdwvmxl/image/upload/v1777032757/step_4_fund_and_activate_wlxoib.png",
  },
  {
    title: "Employees finalize claims",
    body: "Employees find claimable payroll, request the payout payload, and submit the claim transaction.",
    surface: "#121416",
    media: "#181C1F",
    image:
      "https://res.cloudinary.com/dxmdwvmxl/image/upload/v1777032757/step_5_employee_request_xbwshc.png",
  },
  {
    title: "Notify and reconcile",
    body: "Balary updates in-app and email notifications as receipts and backend statuses change.",
    surface: "#131315",
    media: "#1B1B1E",
    image:
      "https://res.cloudinary.com/dxmdwvmxl/image/upload/v1777032757/step_6_bbnkul.png",
  },
];

export function HowItWorks() {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: "left" | "right") => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const distance = carousel.clientWidth * 0.86;
    carousel.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="how"
      className="relative overflow-hidden bg-[#070708] px-4 py-16 text-white sm:px-6 md:py-24 lg:px-8"
      aria-labelledby="how-title"
    >
      <span id="how-section" className="absolute -top-24" aria-hidden="true" />

      <div className="mx-auto max-w-[1220px]">
        <div className="pb-10 text-left md:pb-14">
          <motion.div
            variants={containerVariant}
            initial="hidden"
            whileInView="visible"
            viewport={VP}
            className="flex max-w-2xl flex-col items-start gap-4"
          >
            <motion.h2
              id="how-title"
              variants={itemVariant}
              className="font-display text-[22px] font-bold leading-[1.1] tracking-normal text-white sm:text-[28px] md:text-[36px]"
            >
              From registration to payout,{" "}
              <span className="text-neutral-500">
                every step is tracked.
              </span>
            </motion.h2>

            <motion.p
              variants={itemVariant}
              className="max-w-[620px] font-subtitle text-[15px] leading-relaxed tracking-normal text-muted-foreground"
            >
              A clear payroll path for HR validation, Coston2 USD₮0 funding,
              employee claims, and event-verified backend reconciliation.
            </motion.p>
          </motion.div>
        </div>

        <motion.div
          variants={containerVariant}
          initial="hidden"
          whileInView="visible"
          viewport={VP}
          ref={carouselRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Balary payroll workflow carousel"
        >
          {STEPS.map((step, index) => (
            <motion.article
              key={step.title}
              variants={itemVariant}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ backgroundColor: step.surface }}
              className="group min-w-[86vw] snap-center overflow-hidden rounded-[20px] border border-white/10 sm:min-w-[360px] sm:rounded-[22px] md:min-w-[390px] lg:min-w-[430px]"
            >
              <motion.div
                whileHover={{ scale: 1.025 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                style={{ backgroundColor: step.media }}
                className="relative flex h-[240px] items-center justify-center overflow-hidden border-b border-white/10 sm:h-[280px] lg:h-[310px]"
              >
                <img
                  src={step.image}
                  alt={`${step.title} workflow screen`}
                  className="relative z-10 h-full max-h-[205px] w-full object-contain p-5 opacity-90 transition duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-100 sm:max-h-[235px] sm:p-7 lg:max-h-[265px]"
                  loading="lazy"
                  draggable={false}
                />
              </motion.div>

              <div className="px-5 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-normal text-[#FE9E15]">
                  <span>Step {String(index + 1).padStart(2, "0")}</span>
                </div>

                <h3 className="text-[21px] font-semibold leading-[1.1] tracking-normal text-white sm:text-[24px] lg:text-[28px]">
                  {step.title}
                </h3>

                <p className="mt-3 max-w-[34ch] font-subtitle text-[13px] leading-[1.72] tracking-normal text-white/55 sm:mt-4">
                  {step.body}
                </p>
              </div>
            </motion.article>
          ))}
        </motion.div>

        <div className="mt-7 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => scrollCarousel("left")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            aria-label="Scroll carousel left"
            title="Scroll left"
          >
            <ArrowLeft size={17} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => scrollCarousel("right")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            aria-label="Scroll carousel right"
            title="Scroll right"
          >
            <ArrowRight size={17} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </section>
  );
}
