import { motion } from "framer-motion";
import { containerVariant, fadeUpVariant, itemVariant, VP } from "../../lib/animations";

export function SectionEyebrow({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariant} className={`flex items-center ${className}`}>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-primary">
        {label}
      </span>
    </motion.div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  align?: "left" | "center";
}) {
  const alignCls =
    align === "center" ? "text-center items-center" : "text-left items-start";

  return (
    <motion.div
      variants={containerVariant}
      initial="hidden"
      whileInView="visible"
      viewport={VP}
      className={`flex max-w-2xl flex-col gap-4 ${alignCls} ${
        align === "center" ? "mx-auto" : ""
      }`}
    >
      {eyebrow && <SectionEyebrow label={eyebrow} />}

      <motion.h2
        variants={fadeUpVariant}
        className="font-display text-[22px] sm:text-[28px] md:text-[36px] font-bold leading-[1.1] tracking-[-0.025em] text-foreground"
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          variants={itemVariant}
          className="text-[15px] leading-relaxed text-muted-foreground"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
