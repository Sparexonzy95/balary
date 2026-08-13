import { motion, useReducedMotion } from "framer-motion";

export function DecryptingHeadline({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{text}</>;

  return (
    <motion.span
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {text}
    </motion.span>
  );
}
