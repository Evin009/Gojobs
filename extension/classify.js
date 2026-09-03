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
  // Split, because forms ask for them as separate fields — one "location"
  // value put a city into a country dropdown, which then matched nothing.
  // Longest patterns first: "country" must not be caught by "location".
  country: ["country", "nation"],
  state: ["state", "province", "region"],
  city: ["city", "town"],
  location: ["location", "address"],
};

// Standard declarations every application asks in slightly different words.
// The user answers these once at onboarding; matching here is only about
// recognising which one a form means — never about deciding the answer.
const DECLARATION_PATTERNS = {
  work_authorization: [
    "legally authorized",
    "authorized to work",
    "work authorization",
    "right to work",
  ],
  visa_sponsorship: ["sponsorship", "visa", "h-1b", "require sponsorship"],
  gender: ["gender"],
  ethnicity: ["hispanic", "latino", "ethnicity", "race"],
  veteran_status: ["veteran", "protected veteran"],
  disability_status: ["disability", "disabled"],
};

// Returns { ...field, kind, profileKey } for one scanned field.
//   kind       -> "profile" | "file" | "question"
//   profileKey -> which stored fact to use, only when kind is "profile"
function classifyField(field) {
  if (field.type === "file") return { ...field, kind: "file" };

  const label = (field.label || "").toLowerCase();

  for (const [key, patterns] of Object.entries(DECLARATION_PATTERNS)) {
    if (patterns.some((p) => label.includes(p))) {
      return { ...field, kind: "declaration", profileKey: key };
    }
  }

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
