/** One way an item may be relevant to the visitor, as written by Gemini and checked by `parseImpacts`. */
export type PersonalizedImpact = {
  category: string;
  relevance: "direct" | "indirect" | "situational";
  explanation: string;
  /** Passage copied from the item's Document that names the matching group or situation. */
  evidence: string;
};

export type GeminiImpactResponse = {
  impacts: PersonalizedImpact[];
};

export const MAX_IMPACTS = 3;
const MAX_CATEGORY = 60;
const MAX_EXPLANATION = 500;
const MAX_EVIDENCE = 400;

/** Markup, or wording that takes a side instead of describing possible relevance. */
const MARKUP = /<\/?[a-z][^>]*>|```/i;
const OPINION =
  /\b(good|bad|great|terrible|harmful|beneficial) (for|to) you\b|\byou should\b|\b(support|oppose) (this|the) (bill|motion|proposal)\b|\bpros\b|\bcons\b|\bwill definitely\b/i;

/**
 * The impacts in `data` if it is exactly `{ impacts: [{ category, relevance, explanation, evidence }, ...] }`
 * with short plain-text strings and neutral wording; otherwise null.
 */
export function parseImpacts(data: unknown): PersonalizedImpact[] | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== "impacts") return null;
  const impacts = (data as { impacts: unknown }).impacts;
  if (!Array.isArray(impacts) || impacts.length > MAX_IMPACTS) return null;

  const parsed: PersonalizedImpact[] = [];
  for (const item of impacts) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const fields = Object.keys(item).sort().join(",");
    if (fields !== "category,evidence,explanation,relevance") return null;
    const { category, relevance, explanation, evidence } = item as Record<string, unknown>;
    if (typeof category !== "string" || typeof explanation !== "string" || typeof evidence !== "string") return null;
    if (relevance !== "direct" && relevance !== "indirect" && relevance !== "situational") return null;
    const cleanCategory = category.trim();
    const cleanExplanation = explanation.trim();
    const cleanEvidence = evidence.trim();
    if (!cleanCategory || cleanCategory.length > MAX_CATEGORY) return null;
    if (!cleanExplanation || cleanExplanation.length > MAX_EXPLANATION) return null;
    if (!cleanEvidence || cleanEvidence.length > MAX_EVIDENCE) return null;
    if (MARKUP.test(cleanCategory + cleanExplanation) || OPINION.test(cleanExplanation)) return null;
    parsed.push({ category: cleanCategory, relevance, explanation: cleanExplanation, evidence: cleanEvidence });
  }
  return parsed;
}
