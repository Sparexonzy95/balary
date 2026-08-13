import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { type MouseEvent, useRef } from "react";
import { Link } from "react-router-dom";

import {
  containerVariant,
  fadeUpVariant,
  itemVariant,
  VP,
} from "../../lib/animations";

const MotionLink = motion.create(Link);

export function FinalCta() {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const smoothX = useSpring(x, { stiffness: 80, damping: 22 });
  const smoothY = useSpring(y, { stiffness: 80, damping: 22 });

  const bgX = useTransform(smoothX, [-200, 200], ["-8%", "8%"]);
  const bgY = useTransform(smoothY, [-200, 200], ["-8%", "8%"]);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  }

  return (
    <section className="relative flex w-full items-center justify-center overflow-hidden bg-[#FE9E15] py-14 md:min-h-[50vh] md:py-0 max-[480px]:items-stretch max-[480px]:py-10">
      <div className="mx-auto w-full max-w-[1100px] px-5 md:px-8 max-[480px]:px-0">
        <motion.div
          ref={ref}
          onMouseMove={handleMouseMove}
          variants={containerVariant}
          initial="hidden"
          whileInView="visible"
          viewport={VP}
          className="relative overflow-hidden rounded-[16px] px-8 py-14 text-black md:px-14 md:py-16 max-[480px]:rounded-none max-[480px]:px-5 max-[480px]:py-10"
        >
          {/* Glow */}
          <motion.div
            style={{ x: bgX, y: bgY }}
            className="pointer-events-none absolute inset-0 opacity-30"
          >
            <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-3xl max-[480px]:h-[300px] max-[480px]:w-[300px]" />
          </motion.div>

          <div className="relative z-10 flex items-center justify-between gap-10 max-[480px]:flex-col max-[480px]:items-stretch max-[480px]:justify-center max-[480px]:gap-8">
            {/* LEFT */}
            <div className="max-w-[700px] flex-1 max-[480px]:max-w-full max-[480px]:flex-none">
              <motion.div
                variants={itemVariant}
                className="mb-3 flex items-center gap-2 max-[480px]:mb-4"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/55 max-[480px]:text-[9px] max-[480px]:tracking-[0.18em]">
                  Launch Balary
                </span>
              </motion.div>

              <motion.h2
                variants={fadeUpVariant}
                className="text-2xl font-semibold leading-tight md:text-4xl lg:text-5xl max-[480px]:text-[26px] max-[375px]:text-[25px] max-[320px]:text-[23px] max-[480px]:leading-[1.08]"
              >
                Experience confidential computation
                <span className="block text-black/70">
                  powered by Flare.
                </span>
              </motion.h2>

              <motion.p
                variants={itemVariant}
                className="mt-5 max-w-[52ch] text-sm leading-relaxed text-black/70 md:text-base max-[480px]:max-w-full max-[480px]:text-[13px] max-[480px]:leading-[1.65] max-[320px]:text-[12.5px]"
              >
                See how private execution and blockchain verification combine to
                create a new class of decentralized applications built around
                sensitive corporate and financial workflows.
              </motion.p>
            </div>

            {/* RIGHT CTA */}
            <motion.div
              variants={itemVariant}
              className="flex flex-shrink-0 flex-col items-center justify-center gap-3 max-[480px]:w-full max-[480px]:items-stretch"
            >
              <MotionLink
                to="/app"
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="decrypt-hover-btn inline-flex items-center justify-center gap-2 rounded-none bg-black px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-black/85 max-[480px]:w-full max-[480px]:px-5 max-[480px]:py-4 max-[480px]:text-[13px]"
              >
                Launch App
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2.5 11.5L11.5 2.5M11.5 2.5H5M11.5 2.5V9"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </MotionLink>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
