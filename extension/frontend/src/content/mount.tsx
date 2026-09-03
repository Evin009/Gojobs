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
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = css;

  const root = document.createElement("div");
  shadow.append(style, root);

  createRoot(root).render(<Shell />);
}

// document_idle already, but a page that swaps its own body (SPA nav) can drop
// the host — remount if it disappears.
mount();
new MutationObserver(() => mount()).observe(document.documentElement, {
  childList: true,
});
