import { AnimatePresence, motion } from "framer-motion";

import { notchBox } from "./geometry";

export type TourStage =
  | "off"
  | "welcome"
  | "hover"
  | "gear"
  | "settings"
  | "fill"
  | "filling"
  | "finale";

// Each beat waits for the user to perform the gesture it describes. A tour you
// click through teaches nothing.
const BEATS: Record<string, string> = {
  hover: "Hover over the notch",
  gear: "Now click the gear to open settings",
  fill: "Now click anywhere on the notch to fill this form",
};

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const spring = { type: "spring" as const, stiffness: 220, damping: 28 };

// The dim is one enormous spread shadow around a transparent box, so the hole
// moves with the box — no mask, no second element to keep in sync.
function Spotlight({ stage }: { stage: TourStage }) {
  // Always the whole notch. Narrowing onto the gear made the surrounding bar
  // go dark mid-beat, which reads as the thing you were just told about
  // disappearing.
  const target = notchBox(stage !== "hover");
  const pad = 8;
  const radius = 20;

  return (
    <motion.div
      {...fade}
      transition={{ duration: 0.28 }}
      className="gojobs-tour-layer"
    >
      <motion.div
        className="gojobs-spot"
        animate={{
          x: target.x - pad,
          y: target.y - pad,
          width: target.width + pad * 2,
          height: target.height + pad * 2,
          borderRadius: radius,
        }}
        transition={spring}
      />

      <motion.div
        className="gojobs-tour-tip"
        animate={{
          x: target.x + target.width / 2,
          y: target.y + target.height + 18,
        }}
        transition={spring}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={stage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {BEATS[stage]}
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
  onStart,
  onDone,
}: {
  stage: TourStage;
  onStart: () => void;
  onDone: () => void;
}) {
  return (
    <AnimatePresence>
      {stage === "welcome" && (
        <Curtain
          key="welcome"
          title="Here's your first application."
          body="Gojobs sits at the top of any application page. Thirty seconds and you'll never fill one of these by hand again."
          action="Show me"
          onAction={onStart}
        />
      )}

      {BEATS[stage] && <Spotlight key="spot" stage={stage} />}

      {/* "settings" and "filling" show nothing on purpose — the user is
          reading the settings panel, or watching their own form fill, and a
          dim would hide the thing worth looking at. */}

      {stage === "finale" && (
        <Curtain
          key="finale"
          title="Let the fun begin."
          body="Form filled, tour done. The gear is always on the notch when you want to change an answer."
          action="Get to work"
          onAction={onDone}
        />
      )}
    </AnimatePresence>
  );
}
