import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  messages: string[];
  brandColor: string;
};

export function AnnouncementBar({ messages, brandColor }: Props) {
  const [current, setCurrent] = useState(0);
  const total = messages.length;

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setCurrent((i) => (i + 1) % total), 4000);
    return () => clearInterval(id);
  }, [total]);

  const msg = messages[current] ?? "";

  return (
    <div
      className="h-8 flex items-center justify-center overflow-hidden px-4"
      style={{ background: brandColor }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={current}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="text-white text-xs font-semibold text-center whitespace-nowrap"
        >
          {msg}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
