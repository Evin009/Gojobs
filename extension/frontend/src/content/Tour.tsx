import { AnimatePresence, motion } from "framer-motion";

import { notchBox } from "./geometry";

export type TourStage =
  | "off"
  | "welcome"
  | "hover"
  | "settings"
  | "fill"
  | "filling"
  | "settingsAgain"
  | "finale";

// Each spotlight beat waits for the user to actually do the thing, rather than
// for a Next button. A tour you click through teaches nothing.
const BEATS: Record<string, string> = {
  hover: "Hover to interact",
  settings: "Click the gear to reopen setup",
  fill: "Click anywhere to start filling",
  settingsAgain: "The gear is always here — reopen setup any time",
};

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// The dim is one enormous spread shadow around a transparent box, so the hole
// moves with the box — no mask, no second element to keep in sync.
function Spotlight({ open, label }: { open: boolean; label: string }) {
  const box = notchBox(open);

  return (
    <motion.div
      {...fade}
      transition={{ duration: 0.28 }}
      className="gojobs-tour-layer"
    >
      <motion.div
        className="gojobs-spot"
        animate={{
          x: box.x - 6,
          y: -8,
          width: box.width + 12,
          height: box.height + 14,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
      />

      <motion.div
        className="gojobs-tour-tip"
        animate={{ x: box.x + box.width / 2, y: box.height + 18 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function Curtain({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <motion.div
      {...fade}
      transition={{ duration: 0.35 }}
      className="gojobs-curtain"
    >
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.12, type: "spring", stiffness: 200, damping: 24 }}
        className="gojobs-curtain-inner"
      >
        <h1 className="gojobs-curtain-title">{title}</h1>
        <p className="gojobs-curtain-body">{body}</p>
        <button className="gojobs-curtain-action" onClick={onAction}>
          {action}
        </button>
      </motion.div>
    </motion.div>
  );
}

export function Tour({
  stage,
  notchOpen,
  onStart,
  onContinue,
  onDone,
}: {
  stage: TourStage;
  notchOpen: boolean;
  onStart: () => void;
  onContinue: () => void;
  onDone: () => void;
}) {
  return (
    <AnimatePresence>
      {stage === "welcome" && (
        <Curtain
          key="welcome"
          title="Here's your first application."
          body="Gojobs sits at the top of any application page. Thirty seconds and you'll never fill one by hand again."
          action="Show me"
          onAction={onStart}
        />
      )}

      {/* "filling" has no overlay on purpose — the user is watching their own
          form fill, and dimming it would hide the thing worth seeing. */}
      {BEATS[stage] && <Spotlight key="spot" open={notchOpen} label={BEATS[stage]} />}

      {stage === "finale" && (
        <Curtain
          key="finale"
          title="Let the fun begin."
          body="One application down. The gear stays on the notch — that's where you change an answer or swap your resume."
          action="Show me that"
          onAction={onContinue}
        />
      )}
    </AnimatePresence>
  );
}
