import { motion } from "framer-motion";

// The track animates its background, the knob its position — both spring, so
// the switch has weight rather than snapping.
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 text-left"
    >
      <motion.span
        animate={{ backgroundColor: on ? "#c8ff3d" : "#22222b" }}
        transition={{ duration: 0.2 }}
        className="relative h-[18px] w-8 shrink-0 rounded-full"
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className={`absolute top-[3px] h-3 w-3 rounded-full ${
            on ? "right-[3px] bg-ink-950" : "left-[3px] bg-ink-400"
          }`}
        />
      </motion.span>

      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-300">
        {label}
      </span>
    </button>
  );
}
