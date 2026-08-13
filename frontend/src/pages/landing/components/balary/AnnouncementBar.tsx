import { motion } from "framer-motion";

interface AnnouncementBarProps {
  message: string;
  onClose: () => void;
}

export function AnnouncementBar({ message, onClose }: AnnouncementBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="zl-announcement relative grid items-center overflow-hidden px-4 py-2"
      style={{ backgroundColor: "#2e1c04" }}
    >
      <motion.p
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        className="zl-announcement-text text-center text-[11px] font-normal uppercase tracking-[0.2em] text-white"
      >
        {message}
      </motion.p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss announcement"
        className="zl-announcement-close flex h-6 w-6 items-center justify-center rounded-full text-[#d99843]/70 transition-colors hover:bg-white/10 hover:text-[#d99843]"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M1 1l10 10M11 1L1 11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </motion.div>
  );
}
