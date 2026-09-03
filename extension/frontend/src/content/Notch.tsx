import { motion, type Transition } from "framer-motion";
import { useEffect, useState } from "react";

type State = "idle" | "loading" | "progress" | "done";

type Progress = { label: string; index: number; total: number };

// Talks to autofill.js over postMessage — that script owns the form, this owns
// the surface. Only a "go" signal and a count cross the boundary.
const MSG = "gojobs";

export function Notch({
  layoutId,
  transition,
  onSettings,
}: {
  layoutId: string;
  transition: Transition;
  onSettings: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [filled, setFilled] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.source !== MSG) return;

      if (data.type === "progress") {
        setState("progress");
        setProgress(data);
      }

      if (data.type === "filled") {
        setState("done");
        setFilled(data.count);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Locked once filled: a stray second click would overwrite anything the user
  // edited by hand after the fill.
  const locked = state === "done" || state === "loading" || state === "progress";
  const expanded = open || state === "loading" || state === "progress";

  function start() {
    if (locked) return;
    setState("loading");
    // brief pause so the state change reads as deliberate, not as a glitch
    setTimeout(() => window.postMessage({ source: MSG, type: "run" }, "*"), 900);
  }

  return (
    <motion.div
      layoutId={layoutId}
      transition={transition}
      onHoverStart={() => setOpen(true)}
      onHoverEnd={() => setOpen(false)}
      onClick={start}
      animate={{ width: expanded ? 400 : 104, height: expanded ? 64 : 30 }}
      className={`gojobs-notch ${expanded ? "is-open" : ""} ${locked ? "is-locked" : ""}`}
    >
      <motion.button
        className="gojobs-gear"
        animate={{ opacity: expanded && !locked ? 1 : 0 }}
        onClick={(e) => {
          e.stopPropagation(); // the whole notch is the fill target
          onSettings();
        }}
        aria-label="Gojobs settings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 3.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 20.4 9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 2z" />
        </svg>
      </motion.button>

      <motion.div animate={{ opacity: expanded ? 1 : 0 }} className="gojobs-notch-body">
        {state === "idle" && (
          <>
            <span className="gojobs-dot" />
            <span className="gojobs-label">Autofill application</span>
          </>
        )}

        {state === "loading" && (
          <>
            <span className="gojobs-spinner" />
            <span className="gojobs-label">Filling application</span>
          </>
        )}

        {state === "progress" && progress && (
          <div className="gojobs-progress">
            {/* keyed by label so each field re-runs the roll-in */}
            <motion.span
              key={progress.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="gojobs-current"
            >
              {progress.label}
            </motion.span>
            <div className="gojobs-track">
              <motion.div
                className="gojobs-fill"
                animate={{
                  width: `${((progress.index + 1) / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {state === "done" && (
          <>
            <span className="gojobs-dot" />
            <span className="gojobs-label">
              Filled {filled} {filled === 1 ? "field" : "fields"}
            </span>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
