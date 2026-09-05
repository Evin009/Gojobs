// Mirrors backend/internal/roles/roles.go. Ids must match exactly — the
// backend looks up what we store here, and an id it doesn't recognise is
// silently skipped.
//
// Two axes, kept apart because they combine differently: a job must match any
// chosen discipline AND any chosen level. "SWE" plus "Internship" means SWE
// internships, not every SWE job and every internship.

export type Choice = { id: string; label: string };

export const DISCIPLINES: Choice[] = [
  { id: "swe", label: "Software engineering" },
  { id: "aiml", label: "AI / ML" },
  { id: "data", label: "Data" },
  { id: "pm", label: "Product management" },
  { id: "design", label: "Product design" },
  { id: "security", label: "Security" },
];

export const LEVELS: Choice[] = [
  { id: "intern", label: "Internship" },
  { id: "newgrad", label: "New grad" },
  { id: "mid", label: "Mid level" },
  { id: "senior", label: "Senior" },
];
