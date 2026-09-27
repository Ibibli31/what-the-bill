/**
 * The visitor's self-described profile, kept in the browser only (localStorage).
 * Later features read it to personalize bills; nothing here sends it anywhere.
 */

export type UserProfile = {
  ageRange?: string;
  studentStatus?: string;
  employmentStatus?: string;
  occupationIndustry?: string;
  housingStatus?: string;
  transportation?: string;
  familySituation?: string[];
  personalizationEnabled: boolean;
};

export type ProfileAnswers = Omit<UserProfile, "personalizationEnabled">;

type Option = { value: string; label: string };

type SingleQuestion = {
  key: Exclude<keyof ProfileAnswers, "familySituation">;
  multiple: false;
  prompt: string;
  options: Option[];
};

type MultiQuestion = {
  key: "familySituation";
  multiple: true;
  prompt: string;
  options: Option[];
  /** Picking one of these clears every other choice, and vice versa. */
  exclusive: string[];
};

export type ProfileQuestion = SingleQuestion | MultiQuestion;

const PREFER_NOT = { value: "prefer_not_to_say", label: "Prefer not to say" };

export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    key: "ageRange",
    multiple: false,
    prompt: "What is your age range?",
    options: [
      { value: "under_18", label: "Under 18" },
      { value: "18_24", label: "18–24" },
      { value: "25_34", label: "25–34" },
      { value: "35_44", label: "35–44" },
      { value: "45_54", label: "45–54" },
      { value: "55_64", label: "55–64" },
      { value: "65_plus", label: "65+" },
      PREFER_NOT,
    ],
  },
  {
    key: "studentStatus",
    multiple: false,
    prompt: "Are you currently a student?",
    options: [
      { value: "high_school", label: "High school" },
      { value: "college", label: "College" },
      { value: "university", label: "University" },
      { value: "graduate_professional", label: "Graduate / Professional" },
      { value: "no", label: "No" },
      PREFER_NOT,
    ],
  },
  {
    key: "employmentStatus",
    multiple: false,
    prompt: "What is your employment status?",
    options: [
      { value: "full_time", label: "Full-time" },
      { value: "part_time", label: "Part-time" },
      { value: "self_employed", label: "Self-employed" },
      { value: "unemployed", label: "Unemployed / Looking for work" },
      { value: "not_working", label: "Not currently working" },
      { value: "retired", label: "Retired" },
      PREFER_NOT,
    ],
  },
  {
    key: "occupationIndustry",
    multiple: false,
    prompt: "What industry do you work in?",
    options: [
      { value: "technology", label: "Technology" },
      { value: "healthcare", label: "Healthcare" },
      { value: "education", label: "Education" },
      { value: "government", label: "Government / Public Service" },
      { value: "finance_business", label: "Finance / Business" },
      { value: "retail_hospitality", label: "Retail / Hospitality" },
      { value: "trades_construction", label: "Trades / Construction" },
      { value: "transportation", label: "Transportation" },
      { value: "manufacturing", label: "Manufacturing" },
      { value: "agriculture", label: "Agriculture" },
      { value: "professional_services", label: "Professional Services" },
      { value: "other", label: "Other" },
      PREFER_NOT,
    ],
  },
  {
    key: "housingStatus",
    multiple: false,
    prompt: "What best describes your housing situation?",
    options: [
      { value: "rent", label: "Rent" },
      { value: "own", label: "Own" },
      { value: "live_with_family", label: "Live with family" },
      { value: "other", label: "Other" },
      PREFER_NOT,
    ],
  },
  {
    key: "transportation",
    multiple: false,
    prompt: "How do you usually get around?",
    options: [
      { value: "personal_vehicle", label: "Personal vehicle" },
      { value: "public_transit", label: "Public transit" },
      { value: "bicycle", label: "Bicycle" },
      { value: "walking", label: "Walking" },
      { value: "rideshare_taxi", label: "Rideshare / Taxi" },
      { value: "multiple", label: "Multiple methods" },
      { value: "other", label: "Other" },
      PREFER_NOT,
    ],
  },
  {
    key: "familySituation",
    multiple: true,
    prompt: "What describes your family situation?",
    options: [
      { value: "children", label: "I have children" },
      { value: "elderly_care", label: "I care for an elderly family member" },
      { value: "disability_care", label: "I care for someone with a disability" },
      { value: "caregiver_other", label: "I am a caregiver for another person" },
      { value: "none", label: "None of these" },
      PREFER_NOT,
    ],
    exclusive: ["none", PREFER_NOT.value],
  },
];

/** The new family selection after the visitor ticks or unticks `value`. */
export function toggleMulti(question: MultiQuestion, current: string[], value: string): string[] {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (question.exclusive.includes(value)) return [value];
  return [...current.filter((item) => !question.exclusive.includes(item)), value];
}

/** Keeps only known answers from untrusted data (localStorage or a request body). */
export function sanitizeAnswers(data: unknown): ProfileAnswers {
  const answers: ProfileAnswers = {};
  if (!data || typeof data !== "object") return answers;
  const record = data as Record<string, unknown>;
  for (const question of PROFILE_QUESTIONS) {
    const allowed = new Set(question.options.map((option) => option.value));
    const value = record[question.key];
    if (question.multiple) {
      if (Array.isArray(value)) answers.familySituation = value.filter((item) => allowed.has(item));
    } else if (typeof value === "string" && allowed.has(value)) {
      answers[question.key] = value;
    }
  }
  return answers;
}

/** Changes whenever any answer changes; used to throw away analyses made for an older profile. */
export function profileVersion(profile: UserProfile) {
  return JSON.stringify(sanitizeAnswers(profile));
}

/** The answers as readable text, e.g. { "Housing": "Rent" }, leaving out "Prefer not to say". */
export function describeAnswers(answers: ProfileAnswers): Record<string, string | string[]> {
  const described: Record<string, string | string[]> = {};
  for (const question of PROFILE_QUESTIONS) {
    const labelOf = (value: string) => question.options.find((option) => option.value === value)?.label;
    const shared = (value: string) => value !== PREFER_NOT.value;
    if (question.multiple) {
      const labels = (answers.familySituation ?? []).filter(shared).map(labelOf).filter(Boolean) as string[];
      if (labels.length) described[PROFILE_LABELS[question.key]] = labels;
    } else {
      const value = answers[question.key];
      const label = value && shared(value) ? labelOf(value) : undefined;
      if (label) described[PROFILE_LABELS[question.key]] = label;
    }
  }
  return described;
}

const PROFILE_LABELS: Record<keyof ProfileAnswers, string> = {
  ageRange: "Age range",
  studentStatus: "Student status",
  employmentStatus: "Employment status",
  occupationIndustry: "Occupation / industry",
  housingStatus: "Housing",
  transportation: "Transportation",
  familySituation: "Family / caregiver",
};

const STORAGE_KEY = "wtb.profile.v1";
export const PROFILE_CHANGE_EVENT = "wtb:profile-change";

/** The saved profile, or null for a new visitor. Drops any stored value that is no longer an option. */
export function loadProfile(): UserProfile | null {
  let stored: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    stored = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!stored || typeof stored !== "object") return null;
  const enabled = (stored as { personalizationEnabled?: unknown }).personalizationEnabled !== false;
  return { personalizationEnabled: enabled, ...sanitizeAnswers(stored) };
}

export function saveProfile(profile: UserProfile) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    // Private browsing or a full quota: the profile still works for this visit.
    console.error("Saving profile failed:", error);
  }
  window.dispatchEvent(new Event(PROFILE_CHANGE_EVENT));
}
