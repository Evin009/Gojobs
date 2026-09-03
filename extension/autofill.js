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

// Form sits in an embedded frame, notch belongs on the window — they talk over
// postMessage. Top replies to event.source, a direct handle to that frame.
const MSG = "gojobs";

// ---------------------------------------------------------------- top frame

function mountAutofillNotch(onRun) {
  if (document.getElementById("gojobs-autofill")) return null;

  const host = document.createElement("div");
  host.id = "gojobs-autofill";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; }

    /* hover target is wider than the notch, so the pointer doesn't have to
       land precisely on a small pill to open it */
    .zone {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483000;
      width: 460px;
      padding-bottom: 12px;
    }

    .notch {
      position: relative;
      margin: 0 auto;
      height: 30px;
      width: 104px;
      overflow: hidden;

      font-family: ui-sans-serif, -apple-system, "SF Pro Text", system-ui, sans-serif;
      color: #fafafa;
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-top: 0;
      border-radius: 0 0 16px 16px;
      box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.55);
      cursor: pointer;

      transition: width 460ms cubic-bezier(0.16, 1, 0.3, 1),
                  height 460ms cubic-bezier(0.16, 1, 0.3, 1),
                  border-radius 460ms cubic-bezier(0.16, 1, 0.3, 1),
                  opacity 320ms ease,
                  transform 460ms cubic-bezier(0.16, 1, 0.3, 1);

      opacity: 0;
      animation: drop 520ms cubic-bezier(0.16, 1, 0.3, 1) 250ms forwards;
    }

    @keyframes drop {
      from { opacity: 0; transform: translateY(-100%); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* expanded on hover, or held open once the user has committed */
    .zone:hover .notch,
    .notch[data-state="loading"],
    .notch[data-state="progress"] {
      width: 400px;
      height: 64px;
      border-radius: 0 0 22px 22px;
    }

    .notch[data-state="loading"],
    .notch[data-state="progress"] { cursor: default; }

    /* every state is a stacked layer; only one is visible, and they cross-fade */
    .layer {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 0 22px;

      opacity: 0;
      pointer-events: none;
      transition: opacity 340ms ease;
    }

    .zone:hover .notch[data-state="idle"] .layer-idle { opacity: 1; }
    .notch[data-state="loading"] .layer-loading { opacity: 1; }
    .notch[data-state="progress"] .layer-progress { opacity: 1; }
    .zone:hover .notch[data-state="done"] .layer-done { opacity: 1; }

    .label {
      font-size: 13px;
      font-weight: 550;
      letter-spacing: -0.005em;
      white-space: nowrap;
    }

    /* progress: field name centered, bar pinned along the bottom */
    .layer-progress {
      flex-direction: column;
      justify-content: center;
      gap: 0;
    }

    .current {
      font-size: 12.5px;
      font-weight: 500;
      letter-spacing: -0.005em;
      color: rgba(250, 250, 250, 0.92);
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      animation: rollIn 300ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes rollIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .track {
      position: absolute;
      left: 22px;
      right: 22px;
      bottom: 12px;
      height: 3px;
      background: rgba(250, 250, 250, 0.14);
      border-radius: 999px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      width: 0%;
      background: #c8ff3d;
      border-radius: 999px;
      transition: width 320ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* keeps the notch open briefly after a result, even without hover */
    .notch.hold {
      width: 400px;
      height: 64px;
      border-radius: 0 0 22px 22px;
    }
    .notch.hold[data-state="done"] .layer-done { opacity: 1; }

    .notch.leaving {
      opacity: 0;
      width: 30px;
      height: 4px;
      transform: translateY(-100%);
    }

    /* settings, pinned to the notch's top-right. Only reachable once the
       notch is open, so it never competes with the main click target. */
    .gear {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 20px; height: 20px;
      display: grid;
      place-items: center;
      border-radius: 6px;
      color: rgba(250, 250, 250, 0.45);
      opacity: 0;
      pointer-events: none;
      transition: opacity 240ms ease, color 160ms ease, background 160ms ease;
      z-index: 2;
    }
    .zone:hover .notch[data-state="idle"] .gear,
    .zone:hover .notch[data-state="done"] .gear,
    .notch.hold .gear { opacity: 1; pointer-events: auto; }

    .gear:hover { color: #fafafa; background: rgba(250, 250, 250, 0.08); }
    .gear svg { width: 13px; height: 13px; }

    /* the notch stops being a button once the form is filled — refilling a
       submitted application is never what anyone wants */
    .notch[data-locked="true"] { cursor: default; }
    .notch[data-locked="true"] .layer-idle { display: none; }

    /* tour: one bubble under the notch, pointing at what to do */
    .tour {
      position: absolute;
      top: 76px;
      left: 50%;
      transform: translateX(-50%) translateY(-6px);
      width: 268px;
      padding: 13px 15px;

      font-family: ui-sans-serif, -apple-system, system-ui, sans-serif;
      color: #fafafa;
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 13px;
      box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.7);

      opacity: 0;
      pointer-events: none;
      transition: opacity 320ms ease, transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .tour.is-shown {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
      pointer-events: auto;
    }

    .tour-step {
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: #c8ff3d;
      margin-bottom: 7px;
    }
    .tour-body {
      font-size: 12.5px;
      line-height: 1.5;
      color: rgba(250, 250, 250, 0.82);
    }
    .tour-next {
      margin-top: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 600;
      color: #09090b;
      background: #c8ff3d;
      border: 0;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
    }
    .tour-next:hover { background: #9fd420; }

    .dot {
      flex-shrink: 0;
      width: 7px; height: 7px; border-radius: 50%;
      background: #c8ff3d;
      animation: breathe 2s ease-in-out infinite;
    }
    @keyframes breathe {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }

    .spinner {
      flex-shrink: 0;
      width: 12px; height: 12px;
      border: 1.5px solid rgba(250, 250, 250, 0.3);
      border-top-color: #fafafa;
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: reduce) {
      .notch { animation: none; opacity: 1; }
      .dot, .spinner, .current { animation: none; }
    }
  `;

  const zone = document.createElement("div");
  zone.className = "zone";
  zone.innerHTML = `
    <div class="notch" data-state="idle" role="button" tabindex="0">
      <button class="gear" title="Gojobs settings" aria-label="Gojobs settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3.2"></circle>
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 3.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 20.4 9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 2z"></path>
        </svg>
      </button>
      <div class="layer layer-idle">
        <span class="dot"></span>
        <span class="label">Autofill application</span>
      </div>
      <div class="layer layer-loading">
        <span class="spinner"></span>
        <span class="label">Filling application</span>
      </div>
      <div class="layer layer-progress">
        <span class="current"></span>
        <div class="track"><div class="fill"></div></div>
      </div>
      <div class="layer layer-done">
        <span class="dot"></span>
        <span class="label done-label"></span>
      </div>
    </div>
  `;

  const tour = document.createElement("div");
  tour.className = "tour";
  zone.appendChild(tour);

  shadow.append(style, zone);
  document.body.appendChild(host);

  const notch = zone.querySelector(".notch");
  const gear = zone.querySelector(".gear");
  const progressLayer = zone.querySelector(".layer-progress");
  const doneLabel = zone.querySelector(".done-label");

  function showProgress({ label: fieldLabel, index, total }) {
    notch.dataset.state = "progress";

    // replace the node so the roll-in animation restarts for each field
    const old = progressLayer.querySelector(".current");
    const fresh = old.cloneNode(false);
    fresh.textContent = fieldLabel;
    old.replaceWith(fresh);

    progressLayer.querySelector(".fill").style.width =
      `${((index + 1) / total) * 100}%`;
  }

  // Stays put after filling — it's the page's entry point. Holds expanded a
  // moment so the result is seen even if the pointer moved away.
  //
  // Locks afterwards: a filled form should never be refilled by a stray click,
  // and a second pass would overwrite anything the user edited by hand.
  function showResult(filled) {
    notch.dataset.state = "done";
    notch.dataset.locked = "true";
    doneLabel.textContent = `Filled ${filled} ${filled === 1 ? "field" : "fields"}`;
    notch.classList.add("hold");
    setTimeout(() => notch.classList.remove("hold"), 2200);
  }

  function start() {
    if (notch.dataset.locked === "true") return;
    if (notch.dataset.state !== "idle") return;

    // brief loading state so the change reads as deliberate
    progressLayer.querySelector(".fill").style.width = "0%";
    notch.dataset.state = "loading";
    setTimeout(onRun, 1400);
  }

  // ------------------------------------------------------------------ tour

  // Shown once, right after setup. Two beats only — where settings live, and
  // that the notch itself is the button.
  const TOUR = [
    {
      step: "Settings",
      body: "The gear reopens setup. Change an answer or swap your resume any time.",
    },
    {
      step: "Filling",
      body: "Click anywhere on the notch to fill this application. It runs field by field so you can watch it.",
    },
  ];

  function runTour(onDone) {
    let index = 0;

    function render() {
      const beat = TOUR[index];

      tour.innerHTML = `
        <div class="tour-step">${beat.step}</div>
        <div class="tour-body">${beat.body}</div>
        <button class="tour-next">${index === TOUR.length - 1 ? "Got it" : "Next"}</button>
      `;

      tour.querySelector(".tour-next").addEventListener("click", (e) => {
        e.stopPropagation(); // the zone's click starts a fill
        index += 1;
        if (index < TOUR.length) return render();

        tour.classList.remove("is-shown");
        notch.classList.remove("hold");
        onDone?.();
      });
    }

    render();
    // held open so the bubble points at a notch that's actually expanded
    notch.classList.add("hold");
    tour.classList.add("is-shown");
  }

  // ---------------------------------------------------------------- wiring

  gear.addEventListener("click", (e) => {
    e.stopPropagation(); // otherwise the click also starts a fill
    chrome.runtime.sendMessage({ type: "openSettings" });
  });

  // the whole expanded area is clickable, not just the text
  zone.addEventListener("click", start);
  notch.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      start();
    }
  });

  return { showProgress, showResult, runTour };
}

function initTopFrame() {
  let notch = null;
  let formFrame = null;

  function mount() {
    if (notch) return notch;

    notch = mountAutofillNotch(() => {
      // no form on this page: the notch is present but has nothing to fill
      formFrame?.postMessage({ source: MSG, type: "run" }, "*");
    });

    return notch;
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== MSG) return;

    if (data.type === "formFound") {
      formFrame = event.source; // direct handle to the frame holding the form
      mount();
    }

    if (data.type === "progress" && notch) notch.showProgress(data);
    if (data.type === "filled" && notch) notch.showResult(data.count);
  });

  // this page might host the form itself, no iframe involved
  if (isApplicationPage()) {
    window.postMessage({ source: MSG, type: "formFound" }, "*");
  }

  // Setup just finished: show the notch here even without a form, so the
  // handoff from the popup lands somewhere visible, and run the tour once.
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "showNotch") return;

    mount();
    chrome.storage.local.get("tourDone", ({ tourDone }) => {
      if (tourDone) return;
      notch.runTour(() => chrome.storage.local.set({ tourDone: true }));
    });
  });
}

// -------------------------------------------------------------- form frame

if (window.top === window) {
  initTopFrame();
} else if (isApplicationPage()) {
  window.top.postMessage({ source: MSG, type: "formFound" }, "*");
}

// handled wherever the form actually lives, top frame included
window.addEventListener("message", async (event) => {
  const data = event.data;
  if (!data || data.source !== MSG || data.type !== "run") return;
  if (!isApplicationPage()) return;

  const filled = await autofill((p) =>
    window.top.postMessage({ source: MSG, type: "progress", ...p }, "*"),
  );

  window.top.postMessage({ source: MSG, type: "filled", count: filled }, "*");
});
