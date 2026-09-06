import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Chrome } from "../components/ui";
import { Dropdown } from "../components/Dropdown";
import { DISCIPLINES, LEVELS, REGIONS } from "../lib/roles";
import {
  getJobs,
  getSettings,
  saveSettings,
  type JobFeed,
  type Settings,
} from "../lib/api";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "all", label: "All" },
];

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

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

// Exact time and date, so a panel that hasn't refreshed in hours is obvious
// rather than hiding behind a vague "3 hrs ago".
function checkedLabel(iso: string): string {
  if (!iso) return "not run yet";

  const when = new Date(iso);

  const time = when.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const date = when.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return `${time} · ${date}`;
}

export function Jobs({
  onClose,
  onTab,
}: {
  onClose: () => void;
  onTab: (id: string) => void;
}) {
  const [feed, setFeed] = useState<JobFeed | null>(null);
  const [filters, setFilters] = useState<Settings>({});
  // How far back to look. Today by default — the panel is mainly a "what's
  // new" feed, and the wider ranges are for browsing what's been collected.
  const [range, setRange] = useState("today");
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  async function load(which = range) {
    const result = await getJobs(which);
    setFeed(result);
    setState(result ? "ready" : "offline");
  }

  function pickRange(next: string) {
    setRange(next);
    setState("loading");
    load(next);
  }

  useEffect(() => {
    let live = true;

    Promise.all([getSettings(), getJobs("today")]).then(([stored, result]) => {
      if (!live) return;

      setFilters(stored);
      setFeed(result);
      setState(result ? "ready" : "offline");
    });

    return () => {
      live = false;
    };
  }, []);

  // Changing a filter writes it and refetches straight away. No Save: a filter
  // you have to confirm is a filter people forget to confirm, and the count
  // beside it would go on lying until they did.
  async function setFilter(key: string, next: string[]) {
    const updated = { ...filters, [key]: next.join(",") };
    setFilters(updated);

    if (await saveSettings(updated)) await load();
  }

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
        <div className="mb-4 flex items-end gap-6 border-b border-ink-800 pb-4">
          <Stat
            label={RANGES.find((r) => r.id === range)?.label ?? "Today"}
            value={feed?.matching ?? 0}
            loading={state === "loading"}
          />
          <Stat
            label="Last 30m"
            value={feed?.recent ?? 0}
            loading={state === "loading"}
            accent
          />
          <Stat label="Applied" value={feed?.applied ?? 0} loading={state === "loading"} />

          <div className="ml-auto text-right">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-600">
              Checked
            </p>
            <p className="font-mono text-[10px] text-ink-400">
              {state === "ready" ? checkedLabel(feed?.last_checked ?? "") : "—"}
            </p>
          </div>
        </div>

        {/* Range sits with the filters — it is one, just over time rather
            than over content. */}
        <div className="mb-3 flex gap-1">
          {RANGES.map((option) => (
            <button
              key={option.id}
              onClick={() => pickRange(option.id)}
              className={`relative rounded-md px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-colors ${
                option.id === range
                  ? "text-ink-950"
                  : "text-ink-600 hover:text-ink-300"
              }`}
            >
              {option.id === range && (
                <motion.span
                  layoutId="range-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-md bg-acid"
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5">
          <Dropdown
            label="Field"
            options={DISCIPLINES}
            selected={parseList(filters.roles ?? "")}
            onChange={(next) => setFilter("roles", next)}
            anyLabel="Any"
            counts={feed?.counts?.roles}
          />
          <Dropdown
            label="Type"
            options={LEVELS}
            selected={parseList(filters.levels ?? "")}
            onChange={(next) => setFilter("levels", next)}
            anyLabel="Any"
            counts={feed?.counts?.levels}
          />
          <Dropdown
            label="Location"
            options={REGIONS}
            selected={parseList(filters.regions ?? "")}
            onChange={(next) => setFilter("regions", next)}
            anyLabel="Anywhere"
            counts={feed?.counts?.regions}
            alignRight
          />
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
            body="Monitoring runs every 30 minutes. Widen the filters above, or add a board in Settings."
          />
        )}

        {state === "ready" && !!feed && feed.matching > feed.shown && (
          <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-600">
            Showing {feed.shown} of {feed.matching}
          </p>
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
                  <p className="mt-1 truncate font-mono text-[10px] text-ink-300">
                    {job.location}
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
  accent,
}: {
  label: string;
  value: number;
  loading: boolean;
  // the number worth glancing at — everything else is context for it
  accent?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </p>
      {loading ? (
        <div className="mt-1.5 h-6 w-10 rounded bg-ink-800" />
      ) : (
        <p
          className={`font-mono text-[23px] leading-tight tracking-[-0.02em] tabular-nums ${
            accent && value > 0 ? "text-acid" : "text-ink-100"
          }`}
        >
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
