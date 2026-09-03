import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Onboarding } from "../popup/Onboarding";
import { NotchContent } from "./Notch";
import { Tour, type TourStage } from "./Tour";
import { notchBox, panelBox } from "./geometry";

export type Mode = "hidden" | "panel" | "notch";

// One element, two shapes. Not two elements swapped through AnimatePresence:
// that waits for the outgoing exit before the incoming enters, which is what
// made the morph stall halfway.
const morph = { type: "spring" as const, stiffness: 260, damping: 30, mass: 0.9 };

export function Shell() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [notchOpen, setNotchOpen] = useState(false);
  const [tour, setTour] = useState<TourStage>("off");
  const [, setResize] = useState(0);

  // geometry is measured from the window, so it has to be recomputed on resize
  useEffect(() => {
    const onResize = () => setResize((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["setupDone", "tourDone"], (stored) => {
      if (!stored.setupDone) return setMode("panel");

      setMode("notch");
      if (!stored.tourDone) setTour("welcome");
    });

    const listener = (message: { type?: string }) => {
      if (message.type === "openPanel") setMode("panel");
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Each beat waits for the user to do the thing it describes, so the tour
  // teaches the gesture rather than narrating it.
  useEffect(() => {
    if (tour === "hover" && notchOpen) setTour("settings");
  }, [tour, notchOpen]);

  function finishSetup() {
    chrome.storage.local.set({ setupDone: true });
    setMode("notch");
    setTour("welcome");
  }

  function closePanel() {
    setMode("notch");
    // the settings beat is satisfied by opening and closing the panel
    if (tour === "settings") setTour("fill");
  }

  function openPanel() {
    setMode("panel");
  }

  function endTour() {
    chrome.storage.local.set({ tourDone: true });
    setTour("off");
  }

  if (mode === "hidden") return null;

  const box = mode === "panel" ? panelBox() : notchBox(notchOpen);

  return (
    <div className="gojobs-layer">
      <Tour
        stage={tour}
        notchOpen={notchOpen}
        onStart={() => setTour("hover")}
        onDone={endTour}
      />

      <motion.div
        className={`gojobs-surface ${mode === "panel" ? "is-panel" : "is-notch"}`}
        initial={false}
        animate={box}
        transition={morph}
        onHoverStart={() => mode === "notch" && setNotchOpen(true)}
        onHoverEnd={() => setNotchOpen(false)}
      >
        {/* Content cross-fades on its own timing. Letting it scale with the
            box reads as a zoom rather than a morph. */}
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: mode === "panel" ? 0.12 : 0.08 }}
          className="gojobs-surface-content"
        >
          {mode === "panel" ? (
            <Onboarding onFinish={finishSetup} onClose={closePanel} />
          ) : (
            <NotchContent
              open={notchOpen}
              onSettings={openPanel}
              onFilled={() => tour === "fill" && setTour("finale")}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
