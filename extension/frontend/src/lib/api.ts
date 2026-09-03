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
