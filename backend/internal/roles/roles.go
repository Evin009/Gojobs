package roles

// Two separate axes, kept in separate lists because they answer different
// questions: Disciplines is *what the job is*, Levels is *who it's open to*.
// A user wants "SWE internships" — the discipline and the level have to be
// combined with AND, and mixing them into one list makes that impossible.
//
// Data, not logic: adding a category or fixing a missed job title is an edit
// here, and matching stays whole-word (see FilterByKeywords), so "ml" won't
// match "html" and "ai" won't match "email".
type Role struct {
	ID       string
	Label    string
	Keywords []string
}

var Disciplines = []Role{
	{
		ID:    "swe",
		Label: "Software engineering",
		Keywords: []string{
			"software engineer", "software engineering", "swe",
			"backend", "back end", "frontend", "front end", "full stack",
			"fullstack", "developer", "programmer", "platform engineer",
			"infrastructure engineer", "systems engineer",
		},
	},
	{
		ID:    "aiml",
		Label: "AI / ML",
		Keywords: []string{
			"machine learning", "deep learning", "ml engineer", "ai engineer",
			"artificial intelligence", "data scientist", "research scientist",
			"applied scientist", "nlp", "computer vision", "mlops",
		},
	},
	{
		ID:    "data",
		Label: "Data",
		Keywords: []string{
			"data engineer", "data analyst", "analytics engineer",
			"business intelligence", "data platform",
		},
	},
	{
		ID:    "pm",
		Label: "Product management",
		Keywords: []string{
			"product manager", "product management", "associate product manager",
			"apm", "technical program manager", "program manager",
		},
	},
	{
		ID:    "design",
		Label: "Product design",
		Keywords: []string{
			"product designer", "ux designer", "ui designer", "design engineer",
			"user experience", "interaction designer", "visual designer",
		},
	},
	{
		ID:    "security",
		Label: "Security",
		Keywords: []string{
			"security engineer", "application security", "appsec",
			"security analyst", "penetration tester", "offensive security",
		},
	},
}

// Experience level. Choosing none means no level filter at all — every
// seniority, which is a legitimate choice, not an empty one.
var Levels = []Role{
	{
		ID:       "intern",
		Label:    "Internship",
		Keywords: []string{"intern", "internship", "co-op", "coop"},
	},
	{
		ID:       "newgrad",
		Label:    "New grad",
		Keywords: []string{"new grad", "new graduate", "entry level", "university graduate", "early career", "junior"},
	},
	{
		ID:       "mid",
		Label:    "Mid level",
		Keywords: []string{"mid level", "ii", "iii"},
	},
	{
		ID:       "senior",
		Label:    "Senior",
		Keywords: []string{"senior", "staff", "principal", "lead"},
	},
}

// Expand turns chosen ids into one keyword list, looking them up in the given
// set. Unknown ids are skipped rather than failing — a stale id left in
// settings shouldn't stop monitoring entirely.
func Expand(set []Role, ids []string) []string {
	var keywords []string

	for _, id := range ids {
		for _, role := range set {
			if role.ID == id {
				keywords = append(keywords, role.Keywords...)
			}
		}
	}

	return keywords
}
