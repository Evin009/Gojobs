import { motion } from "framer-motion";
import type { ReactNode } from "react";

import type { Field } from "../lib/steps";

// Small on purpose — a 400px popup can't carry a design system, and every
// extra abstraction is one more thing to read.

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  const base =
    "rounded-md px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors disabled:opacity-35";

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "primary"
          ? `${base} bg-acid font-semibold text-ink-950 hover:bg-acid-dim`
          : `${base} text-ink-400 hover:text-ink-100`
      }
    >
      {children}
    </motion.button>
  );
}

export function Input({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const shared =
    "w-full rounded-md border border-ink-700 bg-ink-900 px-2.5 py-2 font-sans text-[12.5px] text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-acid/60 focus:ring-2 focus:ring-acid/10";

  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
        {field.label}
        {field.optional && <span className="ml-1 text-ink-600">opt</span>}
      </span>

      {field.options ? (
        <select
          className={shared}
          value={value || field.options[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((option) => (
            <option key={option} className="bg-ink-900">
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={shared}
          type={field.type ?? "text"}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

// Step counter as a row of ticks rather than a bar — reads as a sequence you
// can see the length of, which a bar hides.
export function Ticks({ total, index }: { total: number; index: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === index ? 18 : 6,
            opacity: i <= index ? 1 : 0.22,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`h-[3px] rounded-full ${i <= index ? "bg-acid" : "bg-ink-600"}`}
        />
      ))}
    </div>
  );
}

export function Heading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-acid">
        {eyebrow}
      </p>
      <h2 className="font-sans text-[20px] font-medium leading-[1.2] tracking-[-0.02em] text-ink-100">
        {title}
      </h2>
      {lede && (
        <p className="mt-2 font-sans text-[12.5px] leading-relaxed text-ink-300">
          {lede}
        </p>
      )}
    </div>
  );
}

// The window chrome: a title bar that makes the popup read as a tool rather
// than a web page in a box.
export function Chrome({
  label,
  onClose,
}: {
  label: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-2.5">
      <div className="h-1.5 w-1.5 animate-sweep rounded-full bg-acid" />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </span>

      {onClose && (
        <button
          onClick={onClose}
          aria-label="Collapse"
          className="ml-auto font-mono text-[13px] leading-none text-ink-600 transition-colors hover:text-ink-100"
        >
          &times;
        </button>
      )}
    </div>
  );
}
