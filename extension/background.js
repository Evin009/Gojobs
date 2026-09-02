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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getProfile") {
    fetch(`${BACKEND}/profile`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({}));

    return true; // keeps the channel open for the async reply
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
