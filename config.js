// Survey content configuration.
// Edit CATEGORIES, ATTRIBUTES, and PALETTES to change what the survey tests —
// no other file needs to change.

export const CATEGORIES = [
  { id: "technology", label: "Technology" },
  { id: "wellness", label: "Wellness" },
  { id: "health_insurance", label: "Health Insurance" },
];

// TODO: replace with the real ~30 attribute words/phrases.
// This same list is used for both the category fit/does-not-fit blocks
// and the color palette block.
export const ATTRIBUTES = ["Compassionate", "Connected", "Tech-forward", "Personal", "Inspiring", "Optimistic", "Bold", "Visionary", "Human", "Transformational", "Trustworthy", "Modern", "Innovative", "Energizing", "Approachable", "Distinctive", "Supportive", "Healthy", "Caring", "Credible", "Empathetic", "Hopeful", "Courageous", "Honorable", "Empowering", "Sophisticated", "Confident"];


// The two color palettes respondents choose between. `image` paths are
// relative to index.html. Swap these for the real palette artwork —
// PNG/JPG/SVG all work.
export const PALETTES = [
  { id: "palette_a", label: "Palette A", image: "assets/images/guidewell_pallete_a.png" },
  { id: "palette_b", label: "Palette B", image: "assets/images/guidewell_pallete_b.png" },
];

// Minimum time, in milliseconds, a respondent must take before an answer is
// accepted on any trial (fit judgment or palette choice). Responses faster
// than this are rejected and the same trial repeats. This guards against
// respondents rushing/spamming through the survey. Set to 0 to disable.
export const MIN_RESPONSE_TIME_MS = 3;

// Where respondents are sent after completing this survey (part 3 of 3).
// The `state` and `rdud` query params are captured from this survey's own
// inbound URL and appended automatically — don't include them here.
export const NEXT_SURVEY_URL = "https://sw2.decipherinc.com/survey/selfserve/34fd/260809";
