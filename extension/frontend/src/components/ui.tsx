import { motion } from "framer-motion";
import type { ReactNode } from "react";

import type { Field } from "../lib/steps";

// Shared bits, kept small on purpose — a 384px popup can't carry a design
// system, and every extra abstraction is one more thing to read.

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
    "rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40";

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "primary"
          ? `${base} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200`
          : `${base} text-zinc-500 hover:text-zinc-900 dark:hover:text-white`
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
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-white/10";

  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-zinc-500">
        {field.label}
        {field.optional && (
          <span className="ml-1 font-normal text-zinc-400">optional</span>
        )}
      </span>

      {field.options ? (
        <select
          className={shared}
          value={value || field.options[0]}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((option) => (
            <option key={option}>{option}</option>
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

// Fills left to right as steps complete. Framer animates the width rather than
// CSS so it shares the same spring as everything else.
export function Rail({ progress }: { progress: number }) {
  return (
    <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800">
      <motion.div
        className="h-full bg-zinc-900 dark:bg-white"
        animate={{ width: `${progress * 100}%` }}
        transition={{ type: "spring", stiffness: 180, damping: 26 }}
      />
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
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-zinc-400">
        {eyebrow}
      </p>
      <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.02em] text-zinc-900 dark:text-white">
        {title}
      </h2>
      {lede && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
          {lede}
        </p>
      )}
    </div>
  );
}
