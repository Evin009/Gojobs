import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

// .tex only: a PDF here would store as mojibake and fail at compile time,
// which is far from where the user could fix it.
export function ResumeDrop({
  filename,
  onFile,
  onError,
}: {
  filename: string;
  onFile: (name: string, text: string) => void;
  onError: (message: string) => void;
}) {
  const [over, setOver] = useState(false);

  function accept(file?: File) {
    if (!file) return;

    if (!file.name.endsWith(".tex")) {
      onError("That needs to be a .tex file");
      return;
    }

    file.text().then((text) => onFile(file.name, text));
  }

  return (
    <motion.label
      whileHover={{ y: -1 }}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      // dragover must be cancelled or the browser navigates to the file
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        accept(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
        filename
          ? "border-solid border-zinc-900 dark:border-white"
          : over
            ? "border-zinc-900 dark:border-white"
            : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <input
        type="file"
        accept=".tex"
        hidden
        onChange={(e) => accept(e.target.files?.[0])}
      />

      <AnimatePresence mode="wait">
        <motion.span
          key={filename || "empty"}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.18 }}
          className="text-xl text-zinc-400"
        >
          {filename ? "✓" : "↥"}
        </motion.span>
      </AnimatePresence>

      <span className="text-[13px] font-semibold text-zinc-900 dark:text-white">
        {filename || "Drop your .tex here"}
      </span>
      <span className="text-[11.5px] text-zinc-400">
        {filename ? "Click to replace" : "or click to choose a file"}
      </span>
    </motion.label>
  );
}
