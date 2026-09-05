// The popup runs on the extension's own origin, so it can call localhost
// directly — unlike content scripts, which go through the service worker.

const BACKEND = "http://localhost:8080";

export type Profile = Record<string, string>;

export async function getProfile(): Promise<Profile> {
  try {
    const response = await fetch(`${BACKEND}/profile`);
    return response.ok ? await response.json() : {};
  } catch {
    return {};
  }
}

export async function saveProfile(facts: Profile): Promise<boolean> {
  if (!Object.keys(facts).length) return true;

  try {
    const response = await fetch(`${BACKEND}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facts),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getBaseResume(): Promise<string> {
  try {
    const response = await fetch(`${BACKEND}/resume/base`);
    if (!response.ok) return "";
    const data = await response.json();
    return data.content ?? "";
  } catch {
    return "";
  }
}

export async function saveBaseResume(content: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND}/resume/base`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type Settings = Record<string, string>;

export async function getSettings(): Promise<Settings> {
  try {
    const response = await fetch(`${BACKEND}/settings`);
    return response.ok ? await response.json() : {};
  } catch {
    return {};
  }
}

export async function saveSettings(values: Settings): Promise<boolean> {
  if (!Object.keys(values).length) return true;

  try {
    const response = await fetch(`${BACKEND}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type Job = {
  company: string;
  role: string;
  url: string;
  source: string;
  location: string;
  created_at: string;
};

// counts[axis][optionId] — how many of today's postings each option would
// bring in, with the other axes still applied.
export type Facets = Record<string, Record<string, number>>;

export type JobFeed = {
  jobs: Job[];
  today: number;
  recent: number;
  applied: number;
  last_checked: string;
  counts: Facets;
};

export async function getJobs(limit = 50): Promise<JobFeed | null> {
  try {
    const response = await fetch(`${BACKEND}/jobs?limit=${limit}`);
    return response.ok ? await response.json() : null;
  } catch {
    // null, not an empty feed: "can't reach the backend" and "found nothing"
    // are different states and the panel says different things about them
    return null;
  }
}
