import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Button, Chrome, Heading, Input, Ticks } from "../components/ui";
import { GithubGuide } from "../components/GithubGuide";
import { ResumeDrop } from "../components/ResumeDrop";
import {
  getBaseResume,
  getProfile,
  saveBaseResume,
  saveProfile,
  type Profile,
} from "../lib/api";
import { DECLARATION_FIELDS, PROFILE_FIELDS } from "../lib/steps";

// landing -> profile -> declarations -> resume -> github -> welcome
const LAST = 5;

// Steps slide in the direction of travel, so forward and back read differently.
const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 26 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -26 }),
};

export function Popup() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [profile, setProfile] = useState<Profile>({});
  const [resume, setResume] = useState({ name: "", text: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Prefill from what's stored, so reopening is editing rather than starting
  // over. A returning user with everything saved lands on the last screen.
  useEffect(() => {
    Promise.all([getProfile(), getBaseResume()]).then(([stored, tex]) => {
      setProfile(stored);
      if (tex) setResume({ name: "resume.tex", text: "" });
      if (Object.keys(stored).length && tex) setStep(LAST);
    });
  }, []);

  function set(key: string, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function go(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  // Saves every step, not once at the end: a half-finished setup is still
  // worth keeping, and closing the popup shouldn't cost the user their typing.
  async function next() {
    setBusy(true);

    const filled = Object.fromEntries(
      Object.entries(profile).filter(([, value]) => value.trim()),
    );

    const savedProfile = await saveProfile(filled);
    const savedResume = resume.text ? await saveBaseResume(resume.text) : true;

    setBusy(false);

    if (!savedProfile || !savedResume) {
      setNote("Can't reach Gojobs — is the backend running?");
      return;
    }

    setNote("");
    if (resume.text) setResume((r) => ({ ...r, text: "" }));
    go(step + 1);
  }

  // Tells the content script to show the notch, then closes the popup — the
  // handoff the welcome screen is describing.
  function handOff() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "showNotch" });
      window.close();
    });
  }

  return (
    <div className="grid-bg min-h-[440px] bg-ink-950 text-ink-100">
      <Chrome label={step === LAST ? "ready" : `setup ${step}/${LAST}`} />

      <div className="px-4 pb-5 pt-5">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            {step === 0 && (
              <>
                <div className="mb-6 mt-2">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-acid">
                    Gojobs
                  </p>
                  <h1 className="mt-3 font-sans text-[27px] font-medium leading-[1.1] tracking-[-0.03em]">
                    Applications,
                    <br />
                    <span className="text-ink-400">already filled.</span>
                  </h1>
                  <p className="mt-3 max-w-[32ch] font-sans text-[12.5px] leading-relaxed text-ink-300">
                    Answer a handful of questions once. Gojobs reuses them on
                    every application you open, and writes only what it can't
                    reuse.
                  </p>
                </div>

                <div className="mb-6 space-y-1.5 border-l border-ink-800 pl-3">
                  {[
                    "Profile and declarations, stored once",
                    "Your LaTeX resume, retailored per job",
                    "Open questions, written in your voice",
                  ].map((line) => (
                    <p
                      key={line}
                      className="font-mono text-[10.5px] leading-relaxed text-ink-400"
                    >
                      {line}
                    </p>
                  ))}
                </div>

                <div className="flex items-center">
                  <span className="font-mono text-[10px] text-ink-600">
                    ~2 min
                  </span>
                  <div className="ml-auto">
                    <Button onClick={() => go(1)}>Begin</Button>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <Heading
                  eyebrow="01 — About you"
                  title="The basics"
                  lede="Typed into every form, exactly as written here."
                />
                <div className="grid grid-cols-2 gap-2.5">
                  {PROFILE_FIELDS.map((field) => (
                    <Input
                      key={field.key}
                      field={field}
                      value={profile[field.key] ?? ""}
                      onChange={(value) => set(field.key, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <Heading
                  eyebrow="02 — Declarations"
                  title="The ones every form asks"
                  lede="These carry legal weight, so they're yours to answer — never guessed. The demographic ones are voluntary everywhere."
                />
                <div className="space-y-2.5">
                  {DECLARATION_FIELDS.map((field) => (
                    <Input
                      key={field.key}
                      field={field}
                      value={profile[field.key] ?? ""}
                      onChange={(value) => set(field.key, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <Heading
                  eyebrow="03 — Resume"
                  title="Your LaTeX source"
                  lede="Bullet wording gets rewritten per job. Your formatting is never touched."
                />
                <ResumeDrop
                  filename={resume.name}
                  onFile={(name, text) => setResume({ name, text })}
                  onError={setNote}
                />
              </>
            )}

            {step === 4 && (
              <>
                <Heading
                  eyebrow="04 — Monitoring"
                  title="Watching GitHub trackers"
                  lede="Community repos post internships before company boards do. Gojobs can watch them for you."
                />
                <GithubGuide />
              </>
            )}

            {step === LAST && (
              <div className="py-6 text-center">
                <motion.div
                  layoutId="notch"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="mx-auto mb-5 flex h-7 w-32 items-center justify-center rounded-full bg-ink-900 ring-1 ring-ink-700"
                >
                  <div className="h-1.5 w-1.5 animate-sweep rounded-full bg-acid" />
                </motion.div>

                <h2 className="font-sans text-[20px] font-medium tracking-[-0.02em]">
                  You're set up.
                </h2>
                <p className="mx-auto mt-2 max-w-[30ch] font-sans text-[12.5px] leading-relaxed text-ink-300">
                  That pill lives at the top of your window from now on. Open an
                  application and click it.
                </p>

                <div className="mt-6 flex justify-center gap-2">
                  <Button variant="ghost" onClick={() => go(1)}>
                    Review
                  </Button>
                  <Button onClick={handOff}>Take me there</Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {step > 0 && step < LAST && (
          <div className="mt-6 flex items-center">
            <Button variant="ghost" onClick={() => go(step - 1)}>
              Back
            </Button>
            <div className="mx-auto">
              <Ticks total={LAST} index={step - 1} />
            </div>
            <Button onClick={next} disabled={busy}>
              {busy ? "Saving" : step === 4 ? "Finish" : "Next"}
            </Button>
          </div>
        )}

        <AnimatePresence>
          {note && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-center font-mono text-[10px] text-ink-400"
            >
              {note}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
