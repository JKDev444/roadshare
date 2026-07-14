import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/** A tiny, dependency-free burst of celebratory particles. Renders nothing
 *  when `show` is false. Auto-hides itself ~900ms after `show` flips true. */
export function Confetti({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 900);
    return () => clearTimeout(t);
  }, [show]);

  const pieces = 18;
  const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "#fbbf24", "#34d399", "#f472b6"];

  return (
    <AnimatePresence>
      {visible && (
        <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
          {Array.from({ length: pieces }).map((_, i) => {
            const angle = (i / pieces) * Math.PI * 2;
            const dist = 90 + Math.random() * 80;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x, y, opacity: 0, scale: 0.6, rotate: 180 }}
                transition={{ duration: 0.85, ease: "easeOut" }}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-sm"
                style={{ background: colors[i % colors.length] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}