import { motion } from "framer-motion";

export function QuoteSeparator({ quote }: { quote: string }) {
  return (
    <div className="relative overflow-hidden py-20 md:py-28">
      {/* hairline top */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/[0.06]" />
      {/* hairline bottom */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />

      {/* large background quotemark */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-display text-[22rem] font-bold leading-none text-white/[0.025]"
      >
        "
      </div>

      <div className="relative mx-auto max-w-[900px] px-6 md:px-8">
        <motion.blockquote
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center font-display text-[clamp(1.15rem,2.4vw,1.65rem)] font-medium leading-[1.55] tracking-[-0.01em] text-foreground/70"
        >
          <span className="text-primary/80">"</span>
          {quote}
          <span className="text-primary/80">"</span>
        </motion.blockquote>
      </div>
    </div>
  );
}
