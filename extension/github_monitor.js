// Runs on every github.com page (per manifest.json). On a repo page
// (github.com/OWNER/REPO) it first asks the backend whether that repo is
// already monitored:
//   already monitored -> passive "Monitoring" badge, auto-fades
//   not monitored     -> full panel with a "Monitor this repo" action
//   backend unreachable -> shows the panel anyway (see isMonitored)
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

// Deliberately fails OPEN: if the backend is down or the check errors, we
// report "not monitored" so the panel still shows. Re-adding a repo is a no-op
// (ON CONFLICT DO NOTHING), whereas wrongly hiding the panel would silently
// leave the user thinking a repo is watched when it isn't.
async function isMonitored(feedURL) {
  try {
    const response = await fetch(`${BACKEND_URL}/repos`);
    if (!response.ok) return false;

    const urls = await response.json();
    return Array.isArray(urls) && urls.includes(feedURL);
  } catch {
    return false;
  }
}

const STYLES = `
  :host {
    all: initial;

    --bg: #ffffff;
    --fg: #18181b;
    --muted: #71717a;
    --border: rgba(9, 9, 11, 0.09);
    --accent: #047857;
    --btn-bg: #18181b;
    --btn-fg: #fafafa;
    --hairline: rgba(9, 9, 11, 0.07);
    --shadow: 0 20px 40px -16px rgba(9, 9, 11, 0.18),
              inset 0 1px 0 rgba(255, 255, 255, 0.06);
    --danger: #b91c1c;
    --danger-border: rgba(185, 28, 28, 0.3);
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --bg: #18181b;
      --fg: #fafafa;
      --muted: #a1a1aa;
      --border: rgba(255, 255, 255, 0.09);
      --accent: #34d399;
      --btn-bg: #fafafa;
      --btn-fg: #18181b;
      --hairline: rgba(255, 255, 255, 0.08);
      --shadow: 0 20px 40px -16px rgba(0, 0, 0, 0.5),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
      --danger: #f87171;
      --danger-border: rgba(248, 113, 113, 0.3);
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
  }

  .surface {
    position: fixed;
    top: 16px;
    right: 16px;

    font-family: ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI Variable Text",
      "Segoe UI", system-ui, sans-serif;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);

    opacity: 0;
    transform: translateX(12px);
    animation: enter 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .surface.leaving {
    animation: leave 320ms cubic-bezier(0.4, 0, 1, 1) forwards;
  }

  @keyframes enter {
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes leave {
    to { opacity: 0; transform: translateX(12px); }
  }

  /* full panel — repo not yet monitored */
  .panel {
    width: 320px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-radius: 16px;
  }

  /* compact passive badge — repo already monitored */
  .badge {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 14px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: -0.005em;
  }

  .badge .label { color: var(--accent); }
  .badge .repo-inline { color: var(--muted); font-weight: 450; }

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
    color: var(--danger);
    background: transparent;
    border: 1px solid var(--danger-border);
    cursor: pointer;
  }

  .dot {
    flex-shrink: 0;
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
    .surface, .dot, .spinner { animation: none; opacity: 1; transform: none; }
  }
`;

// Creates the shadow host and returns the surface plus a dismiss helper,
// so the panel and the badge share one mounting path.
function createShell(surfaceClass) {
  const host = document.createElement("div");
  host.id = "gojobs-root";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;

  const surface = document.createElement("div");
  surface.className = `surface ${surfaceClass}`;

  shadow.append(style, surface);

  function dismiss() {
    surface.classList.add("leaving");
    surface.addEventListener("animationend", () => host.remove(), { once: true });
  }

  return { host, surface, dismiss };
}

// Passive confirmation for a repo that's already being watched
function mountBadge(repo) {
  const { host, surface, dismiss } = createShell("badge");

  surface.innerHTML = `
    <span class="dot"></span>
    <span class="label">Monitoring</span>
    <span class="repo-inline"></span>
  `;
  surface.querySelector(".repo-inline").textContent = repo;

  document.body.appendChild(host);
  setTimeout(dismiss, 2600);
}

// Full prompt for a repo that isn't monitored yet
function mountPanel(owner, repo) {
  const { host, surface, dismiss } = createShell("panel");

  // owner/repo come from the URL — untrusted. They are set via textContent
  // below, never interpolated into innerHTML, so they can't inject markup.
  surface.innerHTML = `
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

  surface.querySelector(".owner").textContent = `${owner}/`;
  surface.querySelector(".name").textContent = repo;

  document.body.appendChild(host);

  const action = surface.querySelector(".action");
  surface.querySelector(".close").addEventListener("click", dismiss);

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

async function init() {
  const repoInfo = getRepoFromURL();
  if (!repoInfo || document.getElementById("gojobs-root")) return;

  const monitored = await isMonitored(guessFeedURL(repoInfo.owner, repoInfo.repo));

  // guard again — the await gives another injection a chance to mount first
  if (document.getElementById("gojobs-root")) return;

  if (monitored) {
    mountBadge(repoInfo.repo);
  } else {
    mountPanel(repoInfo.owner, repoInfo.repo);
  }
}

init();
