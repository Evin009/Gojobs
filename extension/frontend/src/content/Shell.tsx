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
  const [hovered, setHovered] = useState(false);
  const [tour, setTour] = useState<TourStage>("off");
  const [isApplication, setIsApplication] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [tourPending, setTourPending] = useState(false);
  const [tourSeen, setTourSeen] = useState(false);
  const [, setResize] = useState(0);

  // geometry is measured from the window, so recompute it on resize
  useEffect(() => {
    const onResize = () => setResize((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // autofill.js announces a form it can fill — that's what makes this page an
  // application page. The notch appears nowhere else.
  //
  // We ask as well as listen: that script runs at document_idle while this
  // mounts after `load`, so its first announcement goes out before anything is
  // listening. The ping covers that, the listener covers forms that appear
  // later.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.source === MSG && event.data.type === "formFound") {
        setIsApplication(true);
      }
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ source: MSG, type: "ping" }, "*");

    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["setupDone", "tourDone"], (stored) => {
      setSetupDone(Boolean(stored.setupDone));
      setTourSeen(Boolean(stored.tourDone));
      if (stored.setupDone && !stored.tourDone) setTourPending(true);
    });

    // Clicking the toolbar icon opens setup on whatever page the user is on,
    // application or not.
    const listener = (message: { type?: string }) => {
      if (message.type === "openPanel") setMode("panel");
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // The notch belongs on application pages. The panel is never hidden by this
  // — it closes on its own terms.
  useEffect(() => {
    if (mode === "panel") return;
    setMode(setupDone && isApplication ? "notch" : "hidden");
  }, [mode, setupDone, isApplication]);

  // The tour teaches the notch, so it waits for a page that has one.
  //
  // Marked done the moment it starts, not when it finishes: a user who
  // abandons it halfway has still seen it, and meeting the same tour on every
  // subsequent application would be worse than missing its last beat.
  useEffect(() => {
    if (tourPending && !tourSeen && isApplication && mode === "notch" && tour === "off") {
      chrome.storage.local.set({ tourDone: true });
      setTourSeen(true);
      setTour("welcome");
      setTourPending(false);
    }
  }, [tourPending, tourSeen, isApplication, mode, tour]);

  // Hovering satisfies the first beat and reveals the gear the second points at.
  useEffect(() => {
    if (tour === "hover" && hovered) setTour("gear");
  }, [tour, hovered]);

  // The gear beat holds the notch open whether or not the pointer is on it, so
  // the gear the user is being told to click can't disappear under them.
  const notchOpen = hovered || tour === "gear";

  // One beat at a time: until the tour actually asks for a fill, clicking the
  // notch does nothing. Running ahead of the instructions would leave the tour
  // narrating something that already happened.
  const fillBlocked = tour !== "off" && tour !== "fill" && tour !== "filling";

  const endTour = useCallback(() => setTour("off"), []);

  function finishSetup() {
    chrome.storage.local.set({ setupDone: true });
    setSetupDone(true);
    // Only a genuine first finish queues the tour. Reopening settings lands on
    // this same screen, and its Done button must not restart a tour the user
    // has already been through.
    if (!tourSeen) setTourPending(true);
    setMode(isApplication ? "notch" : "hidden");
  }

  function openPanel() {
    if (tour === "gear") setTour("settings");
    setMode("panel");
  }

  function closePanel() {
    setMode(setupDone && isApplication ? "notch" : "hidden");
    if (tour === "settings") setTour("fill");
  }

  if (mode === "hidden") return null;

  const box = mode === "panel" ? panelBox() : notchBox(notchOpen);

  return (
    <div className="gojobs-layer">
      <Tour stage={tour} onStart={() => setTour("hover")} onDone={endTour} />

      <motion.div
        className={`gojobs-surface ${mode === "panel" ? "is-panel" : "is-notch"}`}
        initial={false}
        animate={box}
        transition={morph}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
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
            <Onboarding
              onFinish={finishSetup}
              onClose={closePanel}
              startAtEnd={setupDone}
              hint={
                tour === "settings"
                  ? "This is where your answers live. Close it to carry on."
                  : undefined
              }
            />
          ) : (
            <NotchContent
              open={notchOpen}
              disabled={fillBlocked}
              onSettings={openPanel}
              onFilling={() => tour === "fill" && setTour("filling")}
              // finishes the tour however the fill was reached — the closing
              // curtain is the only thing that marks it complete for the user
              onFilled={() =>
                (tour === "filling" || tour === "fill") && setTour("finale")
              }
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
