import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { Onboarding } from "../popup/Onboarding";
import { NotchContent } from "./Notch";
import { Tour, type TourStage } from "./Tour";
import { notchBox, panelBox } from "./geometry";

export type Mode = "hidden" | "panel" | "notch";

// One element, two shapes. Not two elements swapped through AnimatePresence:
// that waits for the outgoing exit before the incoming enters, which is what
// made the morph stall halfway.
const morph = { type: "spring" as const, stiffness: 260, damping: 30, mass: 0.9 };

const MSG = "gojobs";

export function Shell() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [notchOpen, setNotchOpen] = useState(false);
  const [tour, setTour] = useState<TourStage>("off");
  const [isApplication, setIsApplication] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [tourPending, setTourPending] = useState(false);
  const [, setResize] = useState(0);

  // geometry is measured from the window, so recompute it on resize
  useEffect(() => {
    const onResize = () => setResize((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // autofill.js announces a form it can fill. That's our signal that this page
  // is worth showing the notch on — the surface stays hidden everywhere else.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.source === MSG && event.data.type === "formFound") {
        setIsApplication(true);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["setupDone", "tourDone"], (stored) => {
      setSetupDone(Boolean(stored.setupDone));

      // Setup opens by itself the first time. After that the surface only
      // appears on application pages.
      if (!stored.setupDone) return setMode("panel");
      if (!stored.tourDone) setTourPending(true);
    });

    const listener = (message: { type?: string }) => {
      if (message.type === "openPanel") setMode("panel");
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // The notch belongs on application pages only. Setup is the one exception:
  // it stays put until the user finishes it, wherever they happen to be.
  useEffect(() => {
    if (mode === "panel") return;
    setMode(setupDone && isApplication ? "notch" : "hidden");
  }, [mode, setupDone, isApplication]);

  // The tour teaches the notch, so it can't run until there's a notch to point
  // at — which means an application page, not whatever tab setup finished on.
  useEffect(() => {
    if (tourPending && isApplication && mode === "notch" && tour === "off") {
      setTour("welcome");
      setTourPending(false);
    }
  }, [tourPending, isApplication, mode, tour]);

  // Each beat advances when the user performs the gesture it describes.
  useEffect(() => {
    if (tour === "hover" && notchOpen) setTour("settings");
  }, [tour, notchOpen]);

  function finishSetup() {
    chrome.storage.local.set({ setupDone: true });
    setSetupDone(true);
    setTourPending(true);
    setMode(isApplication ? "notch" : "hidden");
  }

  function closePanel() {
    setMode(setupDone && isApplication ? "notch" : "hidden");
    // the settings beat is satisfied by opening and closing the panel
    if (tour === "settings") setTour("fill");
    if (tour === "settingsAgain") endTour();
  }

  const endTour = useCallback(() => {
    chrome.storage.local.set({ tourDone: true });
    setTour("off");
  }, []);

  if (mode === "hidden") return null;

  const box = mode === "panel" ? panelBox() : notchBox(notchOpen);

  return (
    <div className="gojobs-layer">
      <Tour
        stage={tour}
        notchOpen={notchOpen}
        onStart={() => setTour("hover")}
        onContinue={() => setTour("settingsAgain")}
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
              onSettings={() => setMode("panel")}
              onFilling={() => tour === "fill" && setTour("filling")}
              onFilled={() => tour === "filling" && setTour("finale")}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
