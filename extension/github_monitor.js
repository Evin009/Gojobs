// Runs on every github.com page (per manifest.json). Detects a repo page
// (github.com/OWNER/REPO), mounts a floating panel in the top-right, and on
// click POSTs a guessed listings-feed URL to our backend's /repos endpoint.
//
// UI is rendered inside a Shadow DOM so GitHub's stylesheet can't leak in and
// ours can't leak out.

const BACKEND_URL = "http://localhost:8080"; // TODO: update once hosted

// Parses github.com/OWNER/REPO — returns null on any other kind of page
function getRepoFromURL() {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// Most tracker repos publish listings at this conventional path
function guessFeedURL(owner, repo) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/dev/.github/scripts/listings.json`;
}

const PANEL_STYLES = `
  :host {
    all: initial;
  }

  * {
    box-sizing: border-box;
    margin: 0;
  }

  .panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 320px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;

    font-family: ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI Variable Text",
      "Segoe UI", system-ui, sans-serif;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow:
      0 20px 40px -16px rgba(9, 9, 11, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);

    --bg: #ffffff;
    --fg: #18181b;
    --muted: #71717a;
    --border: rgba(9, 9, 11, 0.09);
    --accent: #047857;
    --btn-bg: #18181b;
    --btn-fg: #fafafa;
    --hairline: rgba(9, 9, 11, 0.07);

    opacity: 0;
    transform: translateX(12px);
    animation: enter 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @media (prefers-color-scheme: dark) {
    .panel {
      --bg: #18181b;
      --fg: #fafafa;
      --muted: #a1a1aa;
      --border: rgba(255, 255, 255, 0.09);
      --accent: #34d399;
      --btn-bg: #fafafa;
      --btn-fg: #18181b;
      --hairline: rgba(255, 255, 255, 0.08);
      box-shadow:
        0 20px 40px -16px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
  }

  .panel.leaving {
    animation: leave 320ms cubic-bezier(0.4, 0, 1, 1) forwards;
  }

  @keyframes enter {
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes leave {
    to { opacity: 0; transform: translateX(12px); }
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .eyebrow {
    font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .repo {
    margin-top: 6px;
    font-size: 14px;
    font-weight: 550;
    letter-spacing: -0.01em;
    line-height: 1.3;
    word-break: break-word;
  }

  .owner { color: var(--muted); font-weight: 450; }

  .close {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: var(--muted);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease;
  }

  .close:hover { color: var(--fg); background: var(--hairline); }

  .desc {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--muted);
  }

  .action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 9px 14px;

    font-family: inherit;
    font-size: 13px;
    font-weight: 550;
    letter-spacing: -0.005em;
    color: var(--btn-fg);
    background: var(--btn-bg);
    border: 0;
    border-radius: 10px;
    cursor: pointer;

    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease;
  }

  .action:hover:not(:disabled) { opacity: 0.88; }
  .action:active:not(:disabled) { transform: scale(0.98); }
  .action:disabled { cursor: default; }

  .action.done {
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--border);
  }

  .action.failed {
    color: #b91c1c;
    background: transparent;
    border: 1px solid rgba(185, 28, 28, 0.3);
    cursor: pointer;
  }

  @media (prefers-color-scheme: dark) {
    .action.failed { color: #f87171; border-color: rgba(248, 113, 113, 0.3); }
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: breathe 2s ease-in-out infinite;
  }

  @keyframes breathe {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.45; transform: scale(0.82); }
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel, .dot, .spinner { animation: none; opacity: 1; transform: none; }
  }
`;

function mountPanel(owner, repo) {
  const host = document.createElement("div");
  host.id = "gojobs-root";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = PANEL_STYLES;

  const panel = document.createElement("div");
  panel.className = "panel";
  // owner/repo come from the URL — untrusted. They are set via textContent
  // below, never interpolated into innerHTML, so they can't inject markup.
  panel.innerHTML = `
    <div class="head">
      <div>
        <p class="eyebrow">Gojobs</p>
        <p class="repo"><span class="owner"></span><span class="name"></span></p>
      </div>
      <button class="close" aria-label="Dismiss">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <p class="desc">Watch this repository and get a Slack alert when new roles are posted.</p>
    <button class="action">Monitor this repo</button>
  `;

  panel.querySelector(".owner").textContent = `${owner}/`;
  panel.querySelector(".name").textContent = repo;

  shadow.append(style, panel);
  document.body.appendChild(host);

  const action = shadow.querySelector(".action");
  const closeBtn = shadow.querySelector(".close");

  function dismiss() {
    panel.classList.add("leaving");
    panel.addEventListener("animationend", () => host.remove(), { once: true });
  }

  closeBtn.addEventListener("click", dismiss);

  action.addEventListener("click", async () => {
    action.disabled = true;
    action.className = "action";
    action.innerHTML = `<span class="spinner"></span> Connecting`;

    try {
      const response = await fetch(`${BACKEND_URL}/repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: guessFeedURL(owner, repo) }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      action.className = "action done";
      action.innerHTML = `<span class="dot"></span> Monitoring`;
      setTimeout(dismiss, 2400);
    } catch {
      action.disabled = false;
      action.className = "action failed";
      action.textContent = "Couldn't reach backend — retry";
    }
  });
}

const repoInfo = getRepoFromURL();
if (repoInfo && !document.getElementById("gojobs-root")) {
  mountPanel(repoInfo.owner, repoInfo.repo);
}
