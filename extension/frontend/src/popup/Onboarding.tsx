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

export function Onboarding({
  onFinish,
  onClose,
}: {
  onFinish: () => void;
  onClose: () => void;
}) {
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

  return (
    <div className="grid-bg min-h-[440px] text-ink-100">
      <Chrome
        label={step === LAST ? "ready" : `setup ${step}/${LAST}`}
        onClose={onClose}
      />

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
              <div className="relative">
                {/* a slow drift behind the type — the panel reads as running,
                    not as a static card */}
                <motion.div
                  aria-hidden
                  animate={{ opacity: [0.28, 0.6, 0.28] }}
                  transition={{ duration: 5.5, repeat: Infinity }}
                  className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full bg-acid/20 blur-[54px]"
                />

                <div className="relative mb-7 mt-3">
                  <div className="mb-5 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 animate-sweep rounded-full bg-acid" />
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-400">
                      Gojobs
                    </span>
                  </div>

                  <h1 className="font-sans text-[31px] font-medium leading-[1.06] tracking-[-0.035em]">
                    Never fill
                    <br />
                    the same form
                    <br />
                    <span className="text-acid">twice.</span>
                  </h1>

                  <p className="mt-4 max-w-[33ch] font-sans text-[12.5px] leading-relaxed text-ink-300">
                    Answer a handful of questions once. Gojobs reuses them on
                    every application you open, retailors your resume to the
                    posting, and writes only what it can't reuse.
                  </p>
                </div>

                <div className="relative mb-7 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-ink-800 ring-1 ring-ink-800">
                  {[
                    ["Once", "Profile & declarations"],
                    ["Per job", "Resume retailored"],
                    ["Never", "Typed by hand"],
                  ].map(([big, small]) => (
                    <div key={small} className="bg-ink-950 px-3 py-3">
                      <p className="font-mono text-[11px] text-acid">{big}</p>
                      <p className="mt-1 font-sans text-[10.5px] leading-snug text-ink-400">
                        {small}
                      </p>
                    </div>
                  ))}
                </div>

                <motion.button
                  onClick={() => go(1)}
                  whileHover="hover"
                  whileTap={{ scale: 0.985 }}
                  className="group relative w-full overflow-hidden rounded-lg bg-acid px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-950"
                >
                  {/* a light sweeps across on hover, so the button answers back */}
                  <motion.span
                    aria-hidden
                    variants={{
                      hover: { x: ["-120%", "120%"] },
                    }}
                    transition={{ duration: 0.75, ease: "easeInOut" }}
                    className="absolute inset-y-0 w-1/3 bg-white/35 blur-md"
                    style={{ x: "-120%" }}
                  />
                  <span className="relative flex items-center justify-center gap-2">
                    Let's get going
                    <motion.span
                      variants={{ hover: { x: 3 } }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    >
                      &rarr;
                    </motion.span>
                  </span>
                </motion.button>

                <p className="mt-3 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-600">
                  About two minutes
                </p>
              </div>
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
              <div className="py-5 text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="mx-auto mb-5 flex h-7 w-28 items-center justify-center rounded-b-2xl bg-ink-900 ring-1 ring-ink-700"
                >
                  <div className="h-1.5 w-1.5 animate-sweep rounded-full bg-acid" />
                </motion.div>

                <h2 className="font-sans text-[20px] font-medium tracking-[-0.02em]">
                  Everything's stored.
                </h2>
                <p className="mx-auto mt-2 max-w-[31ch] font-sans text-[12.5px] leading-relaxed text-ink-300">
                  Now open a job application. That pill appears at the top of
                  the page, and a short tour will show you how it works.
                </p>

                <div className="mx-auto mt-5 max-w-[30ch] rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2.5">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
                    Try
                  </p>
                  <p className="mt-1 font-sans text-[11.5px] leading-snug text-ink-300">
                    Any Greenhouse, Lever or Ashby posting
                  </p>
                </div>

                <div className="mt-6 flex justify-center gap-2">
                  <Button variant="ghost" onClick={() => go(1)}>
                    Review
                  </Button>
                  <Button onClick={onFinish}>Done</Button>
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
