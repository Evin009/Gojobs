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
  const visible = els.filter((el) => el.type != "hidden"); // filter and keep elements which has type != hidden

  const fields = visible.map((el) => ({
    // map elements to id, type and label and retrun a list
    id: el.id || el.name,
    type: el.type || el.tagName.toLowerCase(),
    label: getFieldLabel(el),
  }));

  return fields.filter((f) => f.label); // only add label field drop other
}
