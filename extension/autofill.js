// Fills an application form from stored data, asking Claude only for the
// open-ended questions. File inputs can't be set by script, so they're skipped.

// Content scripts can't call localhost — the worker does it. See background.js.
async function fetchProfile() {
  try {
    const profile = await chrome.runtime.sendMessage({ type: "getProfile" });
    return profile || {};
  } catch {
    return {};
  }
}

// Returns a stored profile key, "GENERATE" (needs writing), or "SKIP".
async function routeQuestion(question, keys) {
  try {
    const reply = await chrome.runtime.sendMessage({
      type: "routeQuestion",
      question,
      keys,
    });
    return reply?.route || "SKIP";
  } catch {
    return "SKIP";
  }
}

// What to type into one question field, or "" to leave it blank. The truthy
// check rejects a key we don't hold and lets GENERATE/SKIP fall through.
async function resolveQuestion(field, profile) {
  const route = await routeQuestion(field.label, Object.keys(profile));

  if (profile[route]) return profile[route];

  if (route === "GENERATE") {
    const response = await chrome.runtime.sendMessage({
      type: "answerQuestion",
      question: field.label,
      profile,
    });

    return response?.answer || "";
  }

  return "";
}

// Keyed by id or name — radio groups share one `name` and often have no id.
function findElement(field) {
  return (
    document.getElementById(field.id) ||
    document.querySelector(`[name="${field.id}"]`)
  );
}

// Stops at a word boundary so "Yes" doesn't match "Yesterday".
function startsWithWord(longer, shorter) {
  if (!longer.startsWith(shorter)) return false;

  const next = longer[shorter.length];
  return next === undefined || !/[a-z0-9]/.test(next);
}

// True if a form option means the same as our stored value — "Yes" matches
// "Yes, I am authorized". Either side can be the longer one.
function looksLike(optionText, value) {
  const option = (optionText || "").trim().toLowerCase();
  const stored = (value || "").trim().toLowerCase();
  if (!option || !stored) return false;

  return (
    option === stored ||
    startsWithWord(option, stored) ||
    startsWithWord(stored, option)
  );
}

// "change", not "input" — that's what a select reports and React listens for.
// No match leaves the field alone; a wrong pick on a declaration is worse.
function fillSelect(el, value) {
  const option = [...el.options].find(
    (o) => looksLike(o.text, value) || looksLike(o.value, value),
  );
  if (!option) return false;

  el.value = option.value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// Meaning lives in the <label>; the value is often an opaque id.
// .click() fires the real events and unchecks the previous choice.
function fillRadio(el, value) {
  const group = [...document.querySelectorAll(`input[name="${el.name}"]`)];

  const match = group.find((radio) => {
    const label = document.querySelector(`label[for="${radio.id}"]`);
    return (
      looksLike(label?.textContent || "", value) ||
      looksLike(radio.value, value)
    );
  });
  if (!match) return false;

  match.click();
  return true;
}

// Any non-empty string is truthy, so "No" would tick the box without these.
const NEGATIVE = [
  "no",
  "false",
  "0",
  "none",
  "decline",
  "decline to self identify",
];

// Ticks unless the stored value is one of the negatives above.
function fillCheckbox(el, value) {
  el.checked = !NEGATIVE.includes(String(value).trim().toLowerCase());
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// A file input can't be set from a path — browser security. The only way in
// is a real File object handed over through a DataTransfer.
function attachFile(el, bytes, filename) {
  const file = new File([bytes], filename, { type: "application/pdf" });

  const transfer = new DataTransfer();
  transfer.items.add(file);
  el.files = transfer.files;

  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// Asks the backend for the tailored PDF and attaches it. Returns false on any
// failure — an unattached resume is obvious to the user, a wrong one isn't.
async function fillFileField(field) {
  const el = findElement(field);
  if (!el) return false;

  const reply = await chrome.runtime.sendMessage({
    type: "prepareResume",
    resumeText: "",
    jobDescription: getJobDescription(),
  });
  if (!reply?.pdf) return false;

  // base64 back to bytes — the message boundary can't carry a Blob
  const binary = atob(reply.pdf);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return attachFile(el, bytes, "resume.pdf");
}

// Routes a field to the filler its element type needs.
function fillField(field, value) {
  const el = findElement(field);
  if (!el || !value) return false;

  if (el.tagName === "SELECT") return fillSelect(el, value);
  if (el.type === "radio") return fillRadio(el, value);
  if (el.type === "checkbox") return fillCheckbox(el, value);

  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

// Fills each field in turn, reporting progress so the UI can show what it's
// working on. The delay is deliberate — instant filling gives no chance to see
// what changed on your own application.
async function autofill(onProgress) {
  const profile = await fetchProfile();
  const fields = classifyFields(scanFields());

  // Declarations fill from stored answers exactly like profile facts — the
  // user gave those once, nothing is inferred here.
  const targets = fields.filter(
    (f) =>
      ((f.kind === "profile" || f.kind === "declaration") &&
        profile[f.profileKey]) ||
      f.kind === "question" ||
      f.kind === "file",
  );

  let filled = 0;
  for (let i = 0; i < targets.length; i++) {
    const field = targets[i];

    if (onProgress) {
      onProgress({ label: field.label, index: i, total: targets.length });
    }

    // File inputs take a generated PDF, not a string
    if (field.kind === "file") {
      if (await fillFileField(field)) filled++;
      await new Promise((r) => setTimeout(r, 260));
      continue;
    }

    const value =
      field.kind === "question"
        ? await resolveQuestion(field, profile)
        : profile[field.profileKey];

    if (fillField(field, value)) filled++;
    await new Promise((r) => setTimeout(r, 260));
  }

  return filled;
}

// The React UI (dist/ui.js) owns the notch and runs only in the top frame.
// This file owns the form and runs in every frame, since the form is often
// nested. They talk over postMessage: UI says "run", this replies with
// progress and a final count. Only a signal and a count cross — profile data
// never leaves the frame that fills it.
const MSG = "gojobs";

// Announces this frame's form to whoever is listening. Called on a schedule
// because a form is rarely there when the script first runs: React boards
// render it late, and the UI mounts after `load`, so a single announcement at
// document_idle is heard by nobody.
function announce() {
  if (!isApplicationPage()) return false;

  const target = window.top === window ? window : window.top;
  target.postMessage({ source: MSG, type: "formFound" }, "*");
  return true;
}

// Re-checks for ten seconds, then stops. A page that hasn't produced a form by
// then isn't going to, and polling forever on every tab is rude.
let announcing = setInterval(announce, 700);
setTimeout(() => clearInterval(announcing), 10000);

// The UI asks on mount, which covers the case where it started listening after
// the form was already found.
window.addEventListener("message", (event) => {
  if (event.data?.source === MSG && event.data.type === "ping") announce();
});

// A nested frame can't hear the top frame's own postMessage, so the top frame
// forwards "run" down to whichever frame announced a form.
if (window.top === window) {
  let formFrame = null;

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== MSG) return;

    if (data.type === "formFound" && event.source !== window) {
      formFrame = event.source; // direct handle, however deeply nested
    }

    // relay down, unless this page hosts the form itself
    if (data.type === "run" && formFrame) {
      formFrame.postMessage({ source: MSG, type: "run" }, "*");
    }

    // relay a child frame's updates up to the UI in this frame
    if (data.type === "progress" || data.type === "filled") {
      if (event.source !== window) {
        window.postMessage(data, "*");
      }
    }
  });
}

announce();

// Handled wherever the form actually lives, top frame included.
window.addEventListener("message", async (event) => {
  const data = event.data;
  if (!data || data.source !== MSG || data.type !== "run") return;
  if (!isApplicationPage()) return;

  const report = (payload) => {
    const target = window.top === window ? window : window.top;
    target.postMessage({ source: MSG, ...payload }, "*");
  };

  const filled = await autofill((p) => report({ type: "progress", ...p }));

  report({ type: "filled", count: filled });
});
