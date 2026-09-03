import { AnimatePresence, motion } from "framer-motion";

import { notchBox } from "./geometry";

export type TourStage =
  | "off"
  | "welcome"
  | "hover"
  | "settings"
  | "fill"
  | "finale";

// Each spotlight beat waits for the user to actually do the thing, rather than
// for a Next button. A tour you click through teaches nothing.
const BEATS: Record<string, { label: string }> = {
  hover: { label: "Hover to interact" },
  settings: { label: "Click the gear to reopen setup" },
  fill: { label: "Click anywhere to start filling" },
};

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// The dim is a huge spread shadow around a transparent box — cheaper than an
// SVG mask and it animates with the hole, so the spotlight can move.
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
          y: box.y - 6,
          width: box.width + 12,
          height: box.height + 12,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
      />

      <motion.div
        className="gojobs-tour-tip"
        animate={{ x: box.x + box.width / 2, y: box.y + box.height + 16 }}
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
  onDone,
}: {
  stage: TourStage;
  notchOpen: boolean;
  onStart: () => void;
  onDone: () => void;
}) {
  return (
    <AnimatePresence>
      {stage === "welcome" && (
        <Curtain
          key="welcome"
          title="You're all set."
          body="Gojobs now lives at the top of every page you open. Here's how to use it — thirty seconds."
          action="Show me"
          onAction={onStart}
        />
      )}

      {(stage === "hover" || stage === "settings" || stage === "fill") && (
        <Spotlight key="spot" open={notchOpen} label={BEATS[stage].label} />
      )}

      {stage === "finale" && (
        <Curtain
          key="finale"
          title="Let the fun begin."
          body="That's one application done. Open another and click the notch — it'll be waiting."
          action="Get to work"
          onAction={onDone}
        />
      )}
    </AnimatePresence>
  );
}
