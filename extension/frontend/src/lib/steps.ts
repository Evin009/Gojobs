// The onboarding questions, as data. Adding a field is a row here, not a new
// component — and the keys match the profile table and classify.js patterns.

import { COUNTRIES, DIAL_CODES, STATES } from "./places";

export type Field = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  options?: string[];
  optional?: boolean;
};

export const PROFILE_FIELDS: Field[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email", type: "email" },
  // Dialling code is its own field: forms usually put it in a separate
  // dropdown, and a number typed with "+1" glued on fails their validation.
  { key: "phone_country_code", label: "Code", options: DIAL_CODES },
  { key: "phone", label: "Phone", type: "tel", placeholder: "555 010 0100" },
  // Separate fields, because forms ask for them separately — a single
  // "location" value ended up in a country dropdown and matched no option.
  { key: "city", label: "City" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "github", label: "GitHub", placeholder: "github.com/you", optional: true },
  { key: "website", label: "Portfolio", optional: true },
];

// Answered once, reused everywhere. AI never decides these — it only maps a
// form's wording onto the key the user already answered.
export const DECLARATION_FIELDS: Field[] = [
  {
    key: "work_authorization",
    label: "Legally authorized to work?",
    options: ["Yes", "No"],
  },
  {
    key: "visa_sponsorship",
    label: "Will you require visa sponsorship?",
    options: ["No", "Yes"],
  },
  {
    key: "gender",
    label: "Gender",
    options: ["Decline to self-identify", "Male", "Female", "Non-binary"],
  },
  {
    key: "ethnicity",
    label: "Race / ethnicity",
    options: [
      "Decline to self-identify",
      "Asian",
      "Black or African American",
      "Hispanic or Latino",
      "Native American or Alaska Native",
      "Native Hawaiian or Pacific Islander",
      "White",
      "Two or more races",
    ],
  },
  {
    key: "veteran_status",
    label: "Veteran status",
    options: [
      "I am not a protected veteran",
      "I identify as a protected veteran",
      "I do not wish to answer",
    ],
  },
  {
    key: "disability_status",
    label: "Disability status",
    options: [
      "I do not wish to answer",
      "No, I do not have a disability",
      "Yes, I have a disability",
    ],
  },
];

// State options depend on the chosen country, so these are built at render
// time rather than sitting in the list above. A country with no standard list
// gets a free-text box, not somebody else's states.
export function locationFields(country: string): Field[] {
  const states = STATES[country];

  return [
    {
      key: "state",
      label: "State / Province",
      ...(states ? { options: states } : { placeholder: "Region" }),
    },
    {
      key: "country",
      label: "Country",
      options: COUNTRIES.map((c) => c.name),
    },
  ];
}

// Names and places are stored the way a form expects to see them: "new york"
// and "NEW YORK" are the same place to a person, and two failed matches to a
// dropdown.
const TITLE_CASE_KEYS = ["first_name", "last_name", "full_name", "city", "state", "country"];

// Small words stay lowercase unless they lead — "Isle of Man", not "Isle Of Man".
const MINOR = new Set(["of", "and", "the", "da", "de", "del", "van", "von"]);

export function normalise(key: string, value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!TITLE_CASE_KEYS.includes(key)) return trimmed;

  return trimmed
    .split(" ")
    .map((word, i) =>
      i > 0 && MINOR.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}
