import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { Choice } from "../lib/roles";

// Multi-select dropdown. Native <select multiple> can't be styled and behaves
// badly inside a shadow root, so this is built from buttons.
//
// Selecting applies immediately — there's no Save. A filter you have to
// confirm is a filter people forget to confirm.
export function Dropdown({
  label,
  options,
  selected,
  onChange,
  anyLabel,
  counts,
  alignRight = false,
}: {
  label: string;
  options: Choice[];
  selected: string[];
  onChange: (next: string[]) => void;
  // what "nothing selected" means, spelled out — an empty filter is a real
  // choice here, not an unfinished one
  anyLabel: string;
  // how many of today's postings each option would bring in
  counts?: Record<string, number>;
  // last column: open the menu leftwards so it stays inside the panel
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const summary = !selected.length
    ? anyLabel
    : selected.length === 1
      ? (options.find((o) => o.id === selected[0])?.label ?? anyLabel)
      : `${options.find((o) => o.id === selected[0])?.label} +${selected.length - 1}`;

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((entry) => entry !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
          selected.length
            ? "border-acid/50 bg-acid/[0.06]"
            : "border-ink-700 bg-ink-900 hover:border-ink-600"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-600">
            {label}
          </span>
          <span
            className={`block truncate font-mono text-[10.5px] ${
              selected.length ? "text-acid" : "text-ink-300"
            }`}
          >
            {summary}
          </span>
        </span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="shrink-0 text-[8px] text-ink-600"
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* catches the next click anywhere else — a document listener
                would have to cope with shadow-DOM event retargeting */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              // wider than its trigger where the labels need it — the menu
              // is the one place the full name has to be readable. right-0
              // keeps the last column's menu inside the panel.
              className={`absolute top-full z-20 mt-1 w-max min-w-full overflow-hidden rounded-md border border-ink-700 bg-ink-900 shadow-[0_16px_36px_-12px_rgba(0,0,0,0.8)] ${
                alignRight ? "right-0" : "left-0"
              }`}
            >
              {options.map((option) => {
                const on = selected.includes(option.id);

                return (
                  <button
                    key={option.id}
                    onClick={() => toggle(option.id)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-ink-800"
                  >
                    <span
                      className={`grid h-3 w-3 shrink-0 place-items-center rounded-[3px] border text-[7px] ${
                        on
                          ? "border-acid bg-acid text-ink-950"
                          : "border-ink-600"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span
                      className={`whitespace-nowrap font-mono text-[10.5px] ${on ? "text-ink-100" : "text-ink-300"}`}
                    >
                      {option.label}
                    </span>

                    {counts && (
                      <span
                        className={`ml-auto pl-3 font-mono text-[10px] tabular-nums ${
                          counts[option.id] ? "text-ink-400" : "text-ink-700"
                        }`}
                      >
                        {counts[option.id] ?? 0}
                      </span>
                    )}
                  </button>
                );
              })}

              {!!selected.length && (
                <button
                  onClick={() => onChange([])}
                  className="w-full border-t border-ink-800 px-2.5 py-1.5 text-left font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-600 transition-colors hover:text-ink-100"
                >
                  Clear
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
