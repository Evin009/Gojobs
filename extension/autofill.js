// Fills the profile fields on an application form from stored data.
// Only handles kind === "profile" for now; questions need Claude, and file
// inputs can't be set by script for security reasons.

const BACKEND = "http://localhost:8080";

// Fetches stored facts: { email: "...", phone: "...", ... }
async function fetchProfile() {
  try {
    const response = await fetch(`${BACKEND}/profile`);
    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    return data;
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
