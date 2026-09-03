import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Button, Heading, Input, Rail } from "../components/ui";
import { ResumeDrop } from "../components/ResumeDrop";
import {
  getBaseResume,
  getProfile,
  saveBaseResume,
  saveProfile,
  type Profile,
} from "../lib/api";
import { DECLARATION_FIELDS, PROFILE_FIELDS } from "../lib/steps";

const STEPS = ["welcome", "profile", "declarations", "resume", "done"] as const;

// Steps slide in the direction of travel, so forward and back read differently.
const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

export function Popup() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [profile, setProfile] = useState<Profile>({});
  const [resume, setResume] = useState({ name: "", text: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Prefill from what's stored, so reopening the popup is editing rather than
  // starting over. A returning user with a resume skips straight to the end.
  useEffect(() => {
    Promise.all([getProfile(), getBaseResume()]).then(([stored, tex]) => {
      setProfile(stored);
      if (tex) setResume({ name: "resume.tex", text: "" });
      if (Object.keys(stored).length && tex) setStep(STEPS.length - 1);
    });
  }, []);

  function set(key: string, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function go(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  // Saves on every step, not once at the end: a half-finished setup is still
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

  return (
    <div className="min-h-[420px] bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Rail progress={step / (STEPS.length - 1)} />

      <div className="px-5 pb-5 pt-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            {step === 0 && (
              <>
                <Heading
                  eyebrow="Gojobs"
                  title="Fill applications without filling them."
                  lede="Answer these once. Gojobs reuses them on every application you open, and writes only what it can't reuse."
                />
                <div className="flex justify-end">
                  <Button onClick={() => go(1)}>Get started</Button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <Heading
                  eyebrow="1 of 3 — About you"
                  title="The basics"
                  lede="Typed into every form, exactly as you write them here."
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
                  eyebrow="2 of 3 — Declarations"
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
                  eyebrow="3 of 3 — Resume"
                  title="Your LaTeX resume"
                  lede="Gojobs rewrites bullet wording per job and leaves your formatting alone. A .tex file, not a PDF."
                />
                <ResumeDrop
                  filename={resume.name}
                  onFile={(name, text) => setResume({ name, text })}
                  onError={setNote}
                />
              </>
            )}

            {step === 4 && (
              <div className="py-4 text-center">
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                >
                  ✓
                </motion.div>
                <h2 className="text-[19px] font-semibold tracking-[-0.02em]">
                  You're set up.
                </h2>
                <p className="mx-auto mt-1.5 max-w-[30ch] text-[12.5px] leading-relaxed text-zinc-500">
                  Open any job application — the notch appears at the top of
                  your window.
                </p>
                <div className="mt-5 flex justify-center">
                  <Button variant="ghost" onClick={() => go(1)}>
                    Review answers
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {step > 0 && step < STEPS.length - 1 && (
          <div className="mt-5 flex items-center">
            <Button variant="ghost" onClick={() => go(step - 1)}>
              Back
            </Button>
            <div className="ml-auto">
              <Button onClick={next} disabled={busy}>
                {busy ? "Saving…" : step === 3 ? "Finish" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {note && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-center text-[11.5px] text-zinc-400"
            >
              {note}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
