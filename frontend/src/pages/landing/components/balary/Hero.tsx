import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { DecryptingHeadline } from "@/components/balary/DecryptingHeadline";

const HERO_IMAGE =
  "https://res.cloudinary.com/dzi3bfl4r/image/upload/v1777235526/ChatGPT_Image_Apr_26_2026_08_57_37_PM_fnh48f.png";

export function Hero() {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !reduceMotion;

  return (
    <section className="zl-hero relative mt-8 flex min-h-screen overflow-hidden bg-[#050505] px-5 py-24 text-white sm:mt-10 sm:px-8 sm:py-28 lg:mt-12 lg:px-12 lg:py-32">
      <motion.div
        aria-hidden="true"
        animate={
          shouldAnimate
            ? { opacity: [0.72, 0.95, 0.72], scale: [1, 1.04, 1] }
            : undefined
        }
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(167,132,76,0.16)_0%,rgba(96,76,43,0.07)_34%,rgba(5,5,5,0)_68%)]"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-screen"
        animate={
          shouldAnimate
            ? {
                opacity: [0.06, 0.11, 0.08],
                backgroundPosition: ["0px 0px", "34px -26px", "0px 0px"],
              }
            : undefined
        }
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E\")",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto grid min-h-[calc(100vh-12rem)] w-full max-w-[1320px] grid-cols-1 items-center gap-12 lg:min-h-[calc(100vh-16rem)] lg:grid-cols-[0.88fr_1.12fr]"
      >
        <div className="relative z-10 max-w-[580px]">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.68, delay: 0.14 }}
            className="zl-hero-title break-normal font-sans text-[clamp(2.08rem,8.8vw,4.15rem)] font-extrabold leading-[0.96] tracking-normal text-[#F4F4F1] [word-break:normal] max-[380px]:text-[1.82rem] lg:text-[clamp(3.45rem,4.8vw,4.45rem)]"
          >
            <span className="block whitespace-nowrap text-[#FE9E15]">
              <DecryptingHeadline text="Balary payroll" />
            </span>
            <span className="block whitespace-nowrap">
              <DecryptingHeadline text="infrastructure" />
            </span>
            <span className="block whitespace-nowrap">
              <DecryptingHeadline text="for institutions" />
            </span>
            <span className="block whitespace-nowrap">
              <DecryptingHeadline text="on Flare." />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.64, delay: 0.22 }}
            className="mt-6 max-w-[620px] font-mono text-[15px] leading-[1.6] tracking-normal text-white/48 sm:text-[17px]"
          >
            Run Coston2 USD₮0 payroll with institution self-registration, HR
            uploads, Finance funding, employee self-claims, and backend event
            tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <Link
              to="/app"
              className="decrypt-hover-btn inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:bg-white/88"
            >
              Get started
            </Link>
            <a
              href="#how-section"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-medium text-white/58 transition hover:text-white"
            >
              Docs
              <span className="ml-2 text-white/35">{"->"}</span>
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.82, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-h-[360px] lg:min-h-[560px]"
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute left-[34%] top-1/2 h-[72%] w-[42%] -translate-y-1/2 rounded-full bg-white/[0.035] blur-3xl"
            animate={
              shouldAnimate
                ? { opacity: [0.26, 0.5, 0.26], x: [-20, 28, -20] }
                : undefined
            }
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.img
            src={HERO_IMAGE}
            alt="Balary Coston2 USD₮0 payroll infrastructure visual"
            className="absolute left-1/2 top-1/2 h-auto w-[156%] max-w-none object-contain opacity-95 drop-shadow-[0_36px_70px_rgba(0,0,0,0.46)] sm:w-[146%] lg:w-[152%]"
            animate={
              shouldAnimate
                ? {
                    y: ["-50%", "-52%", "-50%"],
                    rotate: [-0.35, 0.35, -0.35],
                    scale: [1, 1.018, 1],
                  }
                : { y: "-50%", rotate: 0, scale: 1 }
            }
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              x: "-50%",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 54%, black 70%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0%, black 54%, black 70%, transparent 100%)",
            }}
            draggable={false}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-[12%] left-[-30%] w-[24%] skew-x-[-14deg] bg-white/[0.08] blur-2xl"
            animate={shouldAnimate ? { x: ["0%", "430%"] } : undefined}
            transition={{
              duration: 5.8,
              repeat: Infinity,
              repeatDelay: 2.2,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
