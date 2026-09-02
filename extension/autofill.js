// Fills the profile fields on an application form from stored data.
// Only handles kind === "profile" for now; questions need Claude, and file
// inputs can't be set by script for security reasons.

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

// Asks the backend what an unmatched question actually wants. Returns a stored
// profile key, or "GENERATE" (needs writing), or "SKIP" (leave it alone).
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

// TODO (you): given one field classified as "question", decide what to put in
// it and return that string ("" means leave it blank).
//
//   1. route = await routeQuestion(field.label, Object.keys(profile))
//   2. if route is a key we actually hold  -> return profile[route]
//   3. if route === "GENERATE"             -> ask the service worker:
//        chrome.runtime.sendMessage({ type: "answerQuestion",
//                                     question: field.label, profile })
//      and return its .answer
//   4. anything else (SKIP, unknown key)   -> return ""
//
// Step 2 matters: route can name a key that isn't in profile. Filling from a
// missing key would write "undefined" onto a real application.
async function resolveQuestion(field, profile) {
  const route = await routeQuestion(field.label, Object.keys(profile));

  if (profile[route]) return profile[route];

  if (route === "GENERATE") {
    const response = await chrome.runtime.sendMessage({
      type: "answerQuestion",
      question: field.label,
      profile,
    });

    return response.answer;
  }

  return "";
}

function fillField(field, value) {
  const el = document.getElementById(field.id);
  if (!el || !value) return false;

  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

// Fills each profile field in turn, reporting progress so the UI can show what
// it's working on. The small delay per field is deliberate — instant filling
// gives the user no chance to see what changed on their own application.
async function autofill(onProgress) {
  const profile = await fetchProfile();
  const fields = classifyFields(scanFields());

  // Declarations (work authorization, EEO) fill from stored answers exactly
  // like profile facts — the user gave those once, nothing is inferred here.
  const targets = fields.filter(
    (f) =>
      ((f.kind === "profile" || f.kind === "declaration") &&
        profile[f.profileKey]) ||
      f.kind === "question",
  );

  let filled = 0;
  for (let i = 0; i < targets.length; i++) {
    const field = targets[i];

    if (onProgress) {
      onProgress({ label: field.label, index: i, total: targets.length });
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

// The form usually lives in an embedded frame (Greenhouse), but the notch has
// to sit at the top of the *browser window* — so the two run in different
// frames and talk over postMessage:
//
//   child frame : "I found an application"     -> top
//   top frame   : shows notch, replies "run"   -> that exact frame
//   child frame : streams progress, then done  -> top
//
// The top frame replies to event.source rather than hunting through the frame
// tree: that's a direct handle to whichever frame announced itself, however
// deeply nested it is.
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
      background: #4ade80;
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

    .dot {
      flex-shrink: 0;
      width: 7px; height: 7px; border-radius: 50%;
      background: #4ade80;
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

  shadow.append(style, zone);
  document.body.appendChild(host);

  const notch = zone.querySelector(".notch");
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

  // The notch stays put after filling — it's the entry point for this page, and
  // hovering it later still reports what was filled. Holding it expanded for a
  // moment first means the result is seen even if the pointer has moved away.
  function showResult(filled) {
    notch.dataset.state = "done";
    doneLabel.textContent = `Filled ${filled} ${filled === 1 ? "field" : "fields"}`;
    notch.classList.add("hold");
    setTimeout(() => notch.classList.remove("hold"), 2200);
  }

  function start() {
    const state = notch.dataset.state;
    if (state !== "idle" && state !== "done") return;

    // hold the loading state briefly so the change reads as deliberate,
    // then hand over to the progress bar
    progressLayer.querySelector(".fill").style.width = "0%";
    notch.dataset.state = "loading";
    setTimeout(onRun, 1400);
  }

  // the whole expanded area is clickable, not just the text
  zone.addEventListener("click", start);
  notch.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      start();
    }
  });

  return { showProgress, showResult };
}

function initTopFrame() {
  let notch = null;
  let formFrame = null;

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== MSG) return;

    if (data.type === "formFound" && !notch) {
      formFrame = event.source; // direct handle to the frame holding the form
      notch = mountAutofillNotch(() => {
        formFrame.postMessage({ source: MSG, type: "run" }, "*");
      });
    }

    if (data.type === "progress" && notch) notch.showProgress(data);
    if (data.type === "filled" && notch) notch.showResult(data.count);
  });

  // this page might host the form itself, no iframe involved
  if (isApplicationPage()) {
    window.postMessage({ source: MSG, type: "formFound" }, "*");
  }
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
