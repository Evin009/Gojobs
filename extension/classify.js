// Sorts scanned fields into how each one should be filled:
//   "profile"  -> a fact we already store (name, email, phone, LinkedIn)
//   "file"     -> a document upload (resume, cover letter)
//   "question" -> open-ended, needs Claude to write an answer
//
// Splitting these matters: asking an LLM for someone's own email would be slow,
// cost money, and risk inventing one. Only real questions need judgment.

// label fragments that identify a stored profile fact
const PROFILE_PATTERNS = {
  first_name: ["first name"],
  last_name: ["last name"],
  full_name: ["full name"],
  email: ["email"],
  phone: ["phone", "mobile"],
  linkedin: ["linkedin"],
  github: ["github"],
  website: ["website", "portfolio"],
  location: ["city", "country", "location"],
};

// Returns { ...field, kind, profileKey } for one scanned field.
//   kind       -> "profile" | "file" | "question"
//   profileKey -> which stored fact to use, only when kind is "profile"
function classifyField(field) {
  if (field.type === "file") return { ...field, kind: "file" };

  const label = (field.label || "").toLowerCase();
  if (label.length > 40) return { ...field, kind: "question" };

  for (const [key, patterns] of Object.entries(PROFILE_PATTERNS)) {
    if (patterns.some((p) => label.includes(p))) {
      return { ...field, kind: "profile", profileKey: key };
    }
  }

  return { ...field, kind: "question" };
}

function classifyFields(fields) {
  return fields.map(classifyField);
}
