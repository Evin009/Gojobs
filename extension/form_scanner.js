// Reads the fields off a job application form so they can be classified and filled later.

// Returns the visible text label for one field.
// Real forms don't agree on where the label lives, so try each source in turn
// and return the first non-empty one, trimmed.
function getFieldLabel(el) {
  const x = el.getAttribute("aria-label");
  if (x) return x.trim();
  const p = el.placeholder;
  if (p) return p.trim();

  const label = document.querySelector(`label[for="${el.id}"]`);

  if (label?.textContent) return label.textContent.trim();
}

// Returns an array of { id, type, label } for every fillable field on the page.
function scanFields() {
  const els = [...document.querySelectorAll("input, select, textarea")];
  const skip = ["hidden", "search", "submit", "button"];
  const visible = els.filter((el) => !skip.includes(el.type)); // filter and remove elements which has type in skip

  const fields = visible.map((el) => ({
    // map elements to id, type and label and retrun a list
    id: el.id || el.name,
    type: el.type || el.tagName.toLowerCase(),
    label: getFieldLabel(el),
  }));

  return fields.filter((f) => f.label); // only add label field drop other
}

// check if its actually an application by looking for email and file type for resume uploads
function isApplicationPage() {
  const field_list = scanFields();

  const hasFile = field_list.some((item) => item.type == "file");
  const hasEmail = field_list.some((item) =>
    item.label.toLowerCase().includes("email"),
  );

  return hasEmail && hasFile;
}

// Job boards mark up descriptions differently, so try the known containers
// first and fall back to whatever block holds the most text.
const DESCRIPTION_SELECTORS = [
  "#content",
  ".job__description",
  '[class*="job-description"]',
  '[class*="description"]',
  "article",
];

// A job description is always long; 200 chars keeps out headings and buttons.
const MIN_DESCRIPTION = 200;

// Returns the job description text, or "" if the page has none.
function getJobDescription() {
  for (const selector of DESCRIPTION_SELECTORS) {
    const text = document.querySelector(selector)?.innerText?.trim() || "";
    if (text.length >= MIN_DESCRIPTION) return text;
  }

  return biggestTextBlock();
}

// Fallback for boards we have no selector for: the block with the most text.
// Nav, header and footer are skipped — long, but never the job.
function biggestTextBlock() {
  const blocks = [...document.querySelectorAll("div, section, main")];

  let best = "";

  for (const el of blocks) {
    const text = el.innerText?.trim() || "";

    if (text.length < MIN_DESCRIPTION) continue;
    if (el.closest("nav, header, footer")) continue;

    if (text.length > best.length) best = text;
  }

  return best;
}
