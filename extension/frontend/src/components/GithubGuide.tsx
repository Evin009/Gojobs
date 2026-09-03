// The repo-monitoring prompt appears on GitHub pages the user visits later.
// Explaining it here means it isn't a surprise when it shows up.
const STEPS = [
  { n: "01", text: "Open any job-tracker repo on GitHub" },
  { n: "02", text: "Gojobs checks whether it publishes listings" },
  { n: "03", text: "A panel offers to monitor it — one click" },
  { n: "04", text: "New postings reach you on Slack" },
];

export function GithubGuide() {
  return (
    <div className="space-y-2">
      {STEPS.map((step) => (
        <div
          key={step.n}
          className="flex gap-3 rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2.5"
        >
          <span className="font-mono text-[10px] text-acid">{step.n}</span>
          <span className="font-sans text-[12.5px] leading-snug text-ink-300">
            {step.text}
          </span>
        </div>
      ))}

      <p className="pt-1 font-sans text-[11.5px] leading-relaxed text-ink-400">
        Repos that don't publish a listings feed are skipped silently — you'll
        never see the panel on an ordinary repo.
      </p>
    </div>
  );
}
