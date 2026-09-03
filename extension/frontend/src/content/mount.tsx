import { createRoot } from "react-dom/client";

import { Shell } from "./Shell";
// ?inline hands us the compiled CSS as a string, so it can go inside the
// shadow root — a <link> would land in the page and leak both ways.
import css from "../index.css?inline";

const HOST_ID = "gojobs-ui";

// Shadow DOM so the host page's CSS can't reach in and ours can't reach out.
// Job boards ship aggressive resets; without this the panel inherits them.
function mount() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = css;

  const root = document.createElement("div");
  shadow.append(style, root);

  createRoot(root).render(<Shell />);
}

// Wait for the page to finish loading before injecting anything.
//
// Most job boards are React apps that hydrate on load: an element we added
// beforehand is one their server never rendered, which fails hydration and
// takes down the page's own JS (React error #418). After load, hydration is
// done and an extra node is harmless.
function mountWhenSafe() {
  if (document.readyState === "complete") {
    // one more frame, so a hydration pass scheduled for this tick finishes
    requestAnimationFrame(mount);
    return;
  }

  window.addEventListener("load", () => requestAnimationFrame(mount), {
    once: true,
  });
}

mountWhenSafe();

// An SPA that swaps its own body drops our host with it. Re-check on
// navigation rather than watching the DOM — a MutationObserver here fires on
// every render the page does, and remounting mid-render causes the very
// problem this file is avoiding.
window.addEventListener("popstate", () => setTimeout(mount, 400));
