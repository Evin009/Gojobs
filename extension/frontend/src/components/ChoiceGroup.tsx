import { motion } from "framer-motion";

import type { Choice } from "../lib/roles";

// Multi-select chips. Nothing selected is a valid state meaning "no filter on
// this axis" — the caption says so, because an empty group otherwise reads as
// something the user forgot to fill in.
export function ChoiceGroup({
  options,
  selected,
  onChange,
  emptyMeans,
}: {
  options: Choice[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyMeans: string;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((entry) => entry !== id)
        : [...selected, id],
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option.id);

          return (
            <motion.button
              key={option.id}
              onClick={() => toggle(option.id)}
              whileTap={{ scale: 0.96 }}
              animate={{
                backgroundColor: on ? "#c8ff3d" : "#0e0e12",
                color: on ? "#08080a" : "#9a9aad",
                borderColor: on ? "#c8ff3d" : "#22222b",
              }}
              transition={{ duration: 0.16 }}
              className="rounded-md border px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.02em]"
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>

      {!selected.length && (
        <p className="mt-2 font-sans text-[11px] text-ink-400">{emptyMeans}</p>
      )}
    </div>
  );
}
