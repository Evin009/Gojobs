// Fills the profile fields on an application form from stored data.
// Only handles kind === "profile" for now; questions need Claude, and file
// inputs can't be set by script for security reasons.

const BACKEND = "http://localhost:8080";

// Asks the service worker for the stored facts. The content script can't call
// localhost directly — see background.js for why.
async function fetchProfile() {
  try {
    const profile = await chrome.runtime.sendMessage({ type: "getProfile" });
    return profile || {};
  } catch {
    return {};
  }
}

function fillField(field, value) {
  const el = document.getElementById(field.id);
  if (!el || !value) return false;

  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

async function autofill() {
  const profile = await fetchProfile();
  const fields = classifyFields(scanFields());

  // TEMP DEBUG
  console.log("[Gojobs] profile:", profile);
  console.log("[Gojobs] profile fields:", fields.filter((f) => f.kind === "profile"));

  let filled = 0;
  for (const field of fields) {
    if (field.kind === "profile") {
      if (fillField(field, profile[field.profileKey])) filled++;
    }
  }

  return filled;
}

// Temporary trigger for testing: auto-runs on application pages and logs what
// it filled. Will become a button — silently editing someone's form on page
// load is the wrong default.
if (isApplicationPage()) {
  autofill().then((count) => console.log("[Gojobs] filled", count, "fields"));
}
