// Service worker: does all backend calls on the extension's behalf.
//
// Content scripts can't reach http://localhost from a public site — Chrome
// blocks public -> loopback requests (Private Network Access), and the
// server-side opt-in header no longer lifts it. The service worker isn't
// subject to that: it runs under the extension's own origin using the
// host_permissions declared in the manifest.
//
// So content scripts send a message here, and this replies with the data.

const BACKEND = "http://localhost:8080";   // Go: profile, repos
const AI = "http://localhost:8000";        // Python: Claude-backed answers

// First install opens setup — the extension is useless until the profile and
// resume exist, and nobody thinks to click the toolbar icon unprompted.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The notch's gear reopens setup. A content script can't open the popup
  // itself, so the worker does it.
  if (message.type === "openSettings") {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (message.type === "getProfile") {
    fetch(`${BACKEND}/profile`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({}));

    return true; // keeps the channel open for the async reply
  }

  // Asks which stored answer a question means. Falls back to SKIP on any
  // failure — leaving a field blank is always safe, guessing on someone's
  // real application is not.
  if (message.type === "routeQuestion") {
    fetch(`${AI}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: message.question,
        keys: message.keys || [],
      }),
    })
      .then((r) => (r.ok ? r.json() : { route: "SKIP" }))
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ route: "SKIP" }));

    return true;
  }

  // Returns the tailored PDF as a base64 string. A Blob can't cross the
  // message boundary, so the content script rebuilds the file on its side.
  if (message.type === "prepareResume") {
    fetch(`${AI}/prepare-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: message.resumeText || "",
        job_description: message.jobDescription || "",
      }),
    })
      .then(async (r) => {
        if (!r.ok) return { pdf: "" };

        const buffer = await r.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // chunked: String.fromCharCode on a whole PDF blows the argument limit
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }

        return {
          pdf: btoa(binary),
          score: r.headers.get("X-Resume-Score"),
          tailored: r.headers.get("X-Resume-Tailored") === "true",
        };
      })
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ pdf: "" }));

    return true;
  }

  if (message.type === "answerQuestion") {
    fetch(`${AI}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: message.question,
        resume_text: message.resume || "",
        profile: message.profile || {},
      }),
    })
      .then((r) => (r.ok ? r.json() : { answer: "" }))
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ answer: "" }));

    return true;
  }
});
