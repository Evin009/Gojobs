import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Chrome } from "../components/ui";
import { getJobs, type JobFeed } from "../lib/api";

// Precision drops as things age: minutes matter for something found just now,
// days are enough for anything older than a day.
function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(minutes / 1440);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Shown in the header, so a stale panel is obvious rather than silently wrong.
function checkedLabel(iso: string): string {
  if (!iso) return "not run yet";

  return `checked ${ago(iso)}`;
}

export function Jobs({
  onClose,
  onTab,
}: {
  onClose: () => void;
  onTab: (id: string) => void;
}) {
  const [feed, setFeed] = useState<JobFeed | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  useEffect(() => {
    getJobs().then((result) => {
      setFeed(result);
      setState(result ? "ready" : "offline");
    });
  }, []);

  return (
    <div className="grid-bg min-h-[440px] text-ink-100">
      <Chrome
        label="monitoring"
        onClose={onClose}
        tabs={[
          { id: "jobs", label: "Jobs" },
          { id: "settings", label: "Settings" },
        ]}
        active="jobs"
        onTab={onTab}
      />

      <div className="px-4 pb-5 pt-5">
        {/* Numbers first: the point of this view is "is it working", and a
            count answers that before any list does. */}
        <div className="mb-5 flex items-end gap-6 border-b border-ink-800 pb-5">
          <Stat label="Today" value={feed?.today ?? 0} loading={state === "loading"} />
          <Stat label="Applied" value={feed?.applied ?? 0} loading={state === "loading"} />

          <p className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-600">
            {state === "ready" ? checkedLabel(feed?.last_checked ?? "") : ""}
          </p>
        </div>

        {state === "loading" && <Skeleton />}

        {state === "offline" && (
          <Empty
            title="Can't reach Gojobs"
            body="The backend isn't running, so there's nothing to show."
          />
        )}

        {state === "ready" && !feed?.jobs.length && (
          <Empty
            title="Nothing found yet"
            body="Monitoring runs every 30 minutes. Add a board or widen your filters in Settings."
          />
        )}

        {state === "ready" && !!feed?.jobs.length && (
          <div className="divide-y divide-ink-800">
            {feed.jobs.map((job, i) => (
              <motion.div
                key={job.url}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                // staggered, but capped: past ~15 rows the cascade stops
                // reading as sequence and starts reading as lag
                transition={{ delay: Math.min(i, 15) * 0.022 }}
                className="group flex items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  {/* company first: you decide whether a posting is worth
                      opening by who it's from before what it's called */}
                  <p className="truncate font-sans text-[12.5px] font-medium text-ink-100">
                    {job.company}
                  </p>
                  <p className="truncate font-sans text-[11.5px] text-ink-400">
                    {job.role}
                  </p>
                  <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-600">
                    {ago(job.created_at)} · {job.source === "github" ? "repo" : "greenhouse"}
                  </p>
                </div>

                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-md border border-ink-700 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-300 transition-colors hover:border-acid hover:bg-acid hover:text-ink-950"
                >
                  Apply
                </a>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </p>
      {loading ? (
        <div className="mt-1.5 h-6 w-10 rounded bg-ink-800" />
      ) : (
        <p className="font-mono text-[23px] leading-tight tracking-[-0.02em] text-ink-100">
          {value}
        </p>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <p className="font-sans text-[13px] text-ink-100">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[30ch] font-sans text-[11.5px] leading-relaxed text-ink-400">
        {body}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="divide-y divide-ink-800">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1.5 py-3">
          <div className="h-3 w-2/3 rounded bg-ink-800" />
          <div className="h-2 w-1/3 rounded bg-ink-900" />
        </div>
      ))}
    </div>
  );
}
