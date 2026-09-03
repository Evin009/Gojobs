// Onboarding: collects the profile facts, declarations and resume that autofill
// used to read from hand-seeded rows.
//
// Saves on every step rather than once at the end — a half-finished setup is
// still worth keeping, and a reload shouldn't cost the user their typing.

const BACKEND = "http://localhost:8080";

const steps = [...document.querySelectorAll(".step")];
const railFill = document.querySelector(".rail-fill");
const statusEl = document.getElementById("status");

let current = 0;
let resumeText = "";

function show(index, back = false) {
  const from = steps[current];
  const to = steps[index];
  if (!to || from === to) return;

  from.classList.toggle("is-leaving-back", back);
  from.classList.remove("is-active");

  // let the outgoing step start moving before the incoming one arrives
  requestAnimationFrame(() => {
    to.classList.remove("is-leaving-back");
    to.classList.add("is-active");
  });

  current = index;
  railFill.style.width = `${(index / (steps.length - 1)) * 100}%`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function flash(message) {
  statusEl.textContent = message;
  statusEl.classList.add("is-shown");
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => statusEl.classList.remove("is-shown"), 2400);
}

// Everything the user has typed so far, keyed the way the profile table is.
// Blank fields are dropped — storing "" would look like a real answer and get
// typed into a form.
function collect() {
  const facts = {};

  for (const el of document.querySelectorAll("input[name], select[name], textarea[name]")) {
    const value = el.value.trim();
    if (value) facts[el.name] = value;
  }

  return facts;
}

async function saveProfile() {
  const facts = collect();
  if (!Object.keys(facts).length) return true;

  try {
    const response = await fetch(`${BACKEND}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facts),
    });
    if (!response.ok) throw new Error(response.statusText);
    return true;
  } catch {
    flash("Couldn't reach Gojobs — is the backend running?");
    return false;
  }
}

async function saveResume() {
  if (!resumeText) return true;

  try {
    const response = await fetch(`${BACKEND}/resume/base`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: resumeText }),
    });
    if (!response.ok) throw new Error(response.statusText);
    resumeText = ""; // saved; don't upload it again on a later step
    return true;
  } catch {
    flash("Couldn't save your resume — is the backend running?");
    return false;
  }
}

// Prefill from whatever is already stored, so returning here is editing rather
// than starting over.
async function load() {
  try {
    const profile = await fetch(`${BACKEND}/profile`).then((r) => r.json());

    for (const [key, value] of Object.entries(profile || {})) {
      const el = document.querySelector(`[name="${key}"]`);
      if (el) el.value = value;
    }
  } catch {
    // backend down: the form still works, it just starts empty
  }
}

// ------------------------------------------------------------------ resume

const drop = document.getElementById("resume-drop");
const fileInput = drop.querySelector("input[type=file]");

function acceptFile(file) {
  if (!file) return;

  // .tex is plain text; a PDF here would upload as mojibake and fail later
  if (!file.name.endsWith(".tex")) {
    flash("That needs to be a .tex file");
    return;
  }

  file.text().then((text) => {
    resumeText = text;
    drop.classList.add("is-loaded");
    drop.querySelector(".drop-icon").textContent = "✓";
    drop.querySelector(".drop-title").textContent = file.name;
    drop.querySelector(".drop-sub").textContent =
      `${Math.round(file.size / 1024)} KB — click to replace`;
  });
}

fileInput.addEventListener("change", () => acceptFile(fileInput.files[0]));

// dragover must be cancelled or the browser navigates to the dropped file
for (const type of ["dragenter", "dragover"]) {
  drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add("is-over");
  });
}

for (const type of ["dragleave", "drop"]) {
  drop.addEventListener(type, () => drop.classList.remove("is-over"));
}

drop.addEventListener("drop", (e) => {
  e.preventDefault();
  acceptFile(e.dataTransfer.files[0]);
});

// ----------------------------------------------------------------- wiring

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;

    const ok = (await saveProfile()) && (await saveResume());
    button.disabled = false;
    if (!ok) return;

    if (current === steps.length - 2) {
      const count = Object.keys(collect()).length;
      document.getElementById("summary").textContent =
        `${count} answers stored. They'll be reused on every application.`;
    }

    show(current + 1);
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => show(current - 1, true));
});

document.getElementById("review").addEventListener("click", () => show(1, true));

load();
