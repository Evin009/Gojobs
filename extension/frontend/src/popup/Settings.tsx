import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Button, Chrome, Heading } from "../components/ui";
import { Toggle } from "../components/Toggle";
import { getSettings, saveSettings, type Settings as Values } from "../lib/api";

// Companies are stored as one comma-separated string, but edited as chips —
// a text field invites trailing commas and stray whitespace that then become
// requests to a company named "".
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function Settings({
  onClose,
  onEditProfile,
}: {
  onClose: () => void;
  onEditProfile: () => void;
}) {
  const [values, setValues] = useState<Values>({});
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">(
    "loading",
  );

  useEffect(() => {
    getSettings().then((stored) => {
      setValues(stored);
      setState(Object.keys(stored).length ? "ready" : "error");
    });
  }, []);

  const companies = parseList(values.companies ?? "");
  const slackOn = values.slack_enabled === "true";

  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function addCompany() {
    const name = draft.trim().toLowerCase();
    // Greenhouse board names are lowercase slugs, and a duplicate would double
    // every posting from that company.
    if (!name || companies.includes(name)) return setDraft("");

    set("companies", [...companies, name].join(","));
    setDraft("");
  }

  function removeCompany(name: string) {
    set("companies", companies.filter((entry) => entry !== name).join(","));
  }

  async function save() {
    setState("saving");
    const ok = await saveSettings(values);
    setState(ok ? "ready" : "error");
    if (ok) onClose();
  }

  return (
    <div className="grid-bg min-h-[440px] text-ink-100">
      <Chrome label="settings" onClose={onClose} />

      <div className="space-y-7 px-4 pb-5 pt-5">
        {state === "loading" ? (
          <Skeleton />
        ) : (
          <>
            <section>
              <Heading
                eyebrow="Notifications"
                title="Slack"
                lede="One grouped message per check, not one per job."
              />

              <div className="space-y-3">
                <Toggle
                  on={slackOn}
                  onChange={(next) => set("slack_enabled", String(next))}
                  label={slackOn ? "Notifications on" : "Notifications off"}
                />

                {/* the webhook field is pointless while notifications are off,
                    so it collapses away rather than sitting there inert */}
                <AnimatePresence initial={false}>
                  {slackOn && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <label className="block space-y-1.5 pt-1">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
                          Webhook URL
                        </span>
                        <input
                          value={values.slack_webhook ?? ""}
                          onChange={(e) => set("slack_webhook", e.target.value)}
                          placeholder="https://hooks.slack.com/services/…"
                          className="w-full rounded-md border border-ink-700 bg-ink-900 px-2.5 py-2 font-mono text-[11px] text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-acid/60 focus:ring-2 focus:ring-acid/10"
                        />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            <section className="border-t border-ink-800 pt-6">
              <Heading
                eyebrow="Monitoring"
                title="Greenhouse boards"
                lede="Checked every 30 minutes. Use the board name from the URL, not the company's website."
              />

              <div className="mb-3 flex flex-wrap gap-1.5">
                <AnimatePresence mode="popLayout">
                  {companies.map((name) => (
                    <motion.button
                      key={name}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      onClick={() => removeCompany(name)}
                      className="group flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 font-mono text-[10.5px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
                    >
                      {name}
                      <span className="text-ink-600 transition-colors group-hover:text-acid">
                        &times;
                      </span>
                    </motion.button>
                  ))}
                </AnimatePresence>

                {!companies.length && (
                  <p className="font-sans text-[11.5px] text-ink-400">
                    No boards yet — nothing is being polled.
                  </p>
                )}
              </div>

              <div className="flex gap-1.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCompany()}
                  placeholder="stripe"
                  className="w-full rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1.5 font-mono text-[11px] text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-acid/60 focus:ring-2 focus:ring-acid/10"
                />
                <Button variant="ghost" onClick={addCompany}>
                  Add
                </Button>
              </div>
            </section>

            <section className="border-t border-ink-800 pt-6">
              <Heading
                eyebrow="You"
                title="Your answers"
                lede="Name, contact details and the declarations every form asks."
              />
              <Button variant="ghost" onClick={onEditProfile}>
                Edit answers
              </Button>
            </section>

            <div className="flex items-center border-t border-ink-800 pt-5">
              <AnimatePresence>
                {state === "error" && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="font-mono text-[10px] text-ink-400"
                  >
                    Can't reach Gojobs — is the backend running?
                  </motion.span>
                )}
              </AnimatePresence>

              <div className="ml-auto">
                <Button onClick={save} disabled={state === "saving"}>
                  {state === "saving" ? "Saving" : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Matches the real layout's shape, so nothing jumps when the data lands.
function Skeleton() {
  return (
    <div className="space-y-7">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2.5">
          <div className="h-2 w-16 rounded bg-ink-800" />
          <div className="h-4 w-32 rounded bg-ink-800" />
          <div className="h-8 w-full rounded-md bg-ink-900" />
        </div>
      ))}
    </div>
  );
}
