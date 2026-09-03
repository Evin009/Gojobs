import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Onboarding } from "../popup/Onboarding";
import { Notch } from "./Notch";

// The whole UI is one element in two shapes. `layoutId` on both means Framer
// animates the geometry between them — the panel physically becomes the notch
// and back, which is only possible because they share a document.
const MORPH_ID = "gojobs-surface";

export type Mode = "hidden" | "panel" | "notch";

const spring = { type: "spring" as const, stiffness: 210, damping: 26 };

export function Shell() {
  const [mode, setMode] = useState<Mode>("hidden");

  useEffect(() => {
    // Setup shows the panel; afterwards the notch is the resting state.
    chrome.storage.local.get("setupDone", ({ setupDone }) => {
      setMode(setupDone ? "notch" : "panel");
    });

    // Toolbar icon opens the panel — same surface, expanded.
    const listener = (message: { type?: string }) => {
      if (message.type === "openPanel") setMode("panel");
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  function finish() {
    chrome.storage.local.set({ setupDone: true });
    setMode("notch");
  }

  return (
    <div className="gojobs-layer">
      <AnimatePresence>
        {mode === "panel" && (
          <motion.div
            layoutId={MORPH_ID}
            transition={spring}
            className="gojobs-panel"
          >
            {/* content fades on its own timing so the geometry morph stays
                clean — text scaling with the box looks like a zoom, not a morph */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Onboarding onFinish={finish} onClose={() => setMode("notch")} />
            </motion.div>
          </motion.div>
        )}

        {mode === "notch" && (
          <Notch
            key="notch"
            layoutId={MORPH_ID}
            transition={spring}
            onSettings={() => setMode("panel")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
