import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import balaryMark from "../../../../assets/balary-mark.svg";

/*
  Clean Minimal Loader
  - No gradients
  - No drop shadows
  - Flat dark gray background
  - Flat monochromatic #FE9E15 accents
*/

export function PageLoader() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const minimumVisibleMs = 1800;

    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const nextProgress = Math.min(100, Math.round((elapsed / minimumVisibleMs) * 100));
      setProgress(nextProgress);
    }, 40);

    const completeTimer = window.setTimeout(() => {
      setProgress(100);
      window.clearInterval(timer);
      window.setTimeout(() => setVisible(false), 320);
    }, minimumVisibleMs);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(completeTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "#1f1f1f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              padding: "0 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            <motion.img
              src={balaryMark}
              alt="Balary"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                width: "clamp(7rem, 20vw, 13rem)",
                height: "auto",
                display: "block",
                filter: "drop-shadow(0 0 18px rgba(254, 158, 21, 0.16))",
              }}
            />

            <div
              style={{
                width: "min(260px,72vw)",
                height: "4px",
                background: "#353535",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{
                  height: "100%",
                  background: "#FE9E15",
                  borderRadius: "999px",
                }}
              />
            </div>

            {/* Percent */}
            <span
              style={{
                fontSize: 11,
                letterSpacing: "2px",
                fontWeight: 600,
                color: "#FE9E15",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {Math.floor(progress)}%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
