// The onboarding questions, as data. Adding a field is a row here, not a new
// component — and the keys match the profile table and classify.js patterns.

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
  { key: "phone", label: "Phone", type: "tel" },
  // Separate fields, because forms ask for them separately — a single
  // "location" value ended up in a country dropdown and matched no option.
  { key: "city", label: "City" },
  { key: "state", label: "State / Province" },
  { key: "country", label: "Country" },
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
