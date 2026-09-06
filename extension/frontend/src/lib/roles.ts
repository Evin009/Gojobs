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

// Only what a student can apply to. Mid and senior were noise, and their
// counts dwarfed everything else in the dropdown.
export const LEVELS: Choice[] = [
  { id: "intern", label: "Internship" },
  { id: "coop", label: "Co-op" },
  { id: "newgrad", label: "New grad" },
];

// Where the job is. Only the two we can classify reliably today — see
// backend/internal/location.
export const REGIONS: Choice[] = [
  { id: "us", label: "United States" },
  { id: "canada", label: "Canada" },
];

// Mirrors backend/internal/education. "Not stated" is an option rather than a
// silent pass: most descriptions never mention a degree, so hiding those
// behind an invisible rule would make the filter meaningless.
export const EDUCATION: Choice[] = [
  { id: "bachelors", label: "Bachelor's" },
  { id: "masters", label: "Master's" },
  { id: "phd", label: "PhD" },
  { id: "not_stated", label: "Not stated" },
];

// Terms come from the server — the list moves forward with the calendar, so
// hardcoding it here would rot.
export function termChoices(ids: string[]): Choice[] {
  return [
    ...ids.map((id) => {
      const [season, year] = id.split("_");
      return {
        id,
        label: `${season.charAt(0).toUpperCase()}${season.slice(1)} ${year}`,
      };
    }),
    { id: "not_stated", label: "Not stated" },
  ];
}
