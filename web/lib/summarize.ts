/**
 * Gemini plain-language summaries for bills, motions, consultations and development applications.
 * Server-only: it holds the Gemini API key.
 */
import { GoogleGenAI, Type } from "@google/genai";

if (typeof window !== "undefined") {
  throw new Error("lib/summarize is server-only: it holds the Gemini API key.");
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const MAX_ATTEMPTS = 3;

export type ItemType = "motion" | "dev_app" | "consultation" | "provincial_bill" | "federal_bill";
export type SponsorKind = "government" | "ottawa_member" | "other_member" | "unknown";
export type Summary = { summary: string; confidence: "high" | "low" };

/** The facts about one item that the model is allowed to use. */
export type ItemInput = {
  itemType: ItemType;
  title: string;
  details: string;
  location: string;
  committee: string;
  sponsor: SponsorKind;
  status: string;
};

const SYSTEM_PROMPT = `You write short plain-language summaries for StreetWatch Ottawa, a civic app that shows Ottawa residents what their city, province and country are doing. Many readers have never followed politics, and some read English as a second language.

Summarize the item you are given in the style of these examples:

- "Council is receiving an update on how the city's tax and transit budgets are tracking halfway through 2026, including a forecast of what the year-end financial picture will look like."
- "Council is being asked to set clear service standards for the equipment the city uses to maintain rural roads, like grass cutting, ditch work, and gravel road upkeep in areas like Orléans East-Cumberland, West Carleton-March, and Osgoode. This matters because it helps rural residents know what maintenance to expect and when."

The item has these fields, and any of them may be empty: Type, Title, Details, Location or ward, Committee, Sponsor, Status.
Sponsor is one of: government, ottawa_member, other_member, unknown.

HOW TO START THE SUMMARY
Open with who is doing what, using the wording that fits the type:
- motion: "Council is being asked to…", "Council is receiving an update on…", or "[Committee] is considering…"
- dev_app: "An applicant is asking the City to…", then say what would be built, changed, split, or torn down, and where
- consultation: "The City wants to hear from residents about…"
- provincial_bill: "The Ontario government wants to…" (government), "An Ottawa MPP is proposing…" (ottawa_member), otherwise "An MPP is proposing…"
- federal_bill: "The federal government wants to…" (government), "An Ottawa MP is proposing…" (ottawa_member), otherwise "An MP is proposing…"

RULES
1. Length: 1-2 sentences, 15-60 words. Shorter is fine when the input is thin.
2. Sentence 1 says what is being proposed or decided, in concrete terms. Name specific places, wards, or streets only if the input gives them. For a technical item, add a short "like…" list of real examples taken from the input only.
3. Add a second sentence starting "This matters because…" only when the input makes the effect on residents clear. Never speculate. Never add it for a bill or development application that only has a title, type, or address.
4. Use everyday words at a Grade 6-8 reading level. Explain or avoid jargon: say "the rules for what can be built" instead of "zoning by-law amendment," "the application" instead of "the file," and "vote" instead of "division." Spell out acronyms, except very common ones.
5. Stay neutral. Don't take sides, praise, or criticize. Ignore slogans in official bill titles ("Protecting Ontario by…") and describe the actual change. Do not name or describe the sponsor or party.
6. Describe the proposal, not the outcome. The app shows status separately, so never say whether it passed, failed, or became law.
7. Use only the information given. Never invent numbers, dates, places, or effects. If you had to guess what a bill does from its title alone, set confidence to "low"; otherwise set it to "high".
8. No headings, bullet points, quotation marks, or preamble.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["high", "low"] },
  },
  required: ["summary", "confidence"],
};

const OUTCOME_WORDS = /\b(passed|failed|defeated|became law|was carried|was approved)\b/i;

/** The model-facing text for an item; also what a saved summary is compared against. */
export function describe(input: ItemInput) {
  return [
    `Type: ${input.itemType}`,
    `Title: ${input.title}`,
    `Details: ${input.details}`,
    `Location or ward: ${input.location}`,
    `Committee: ${input.committee}`,
    `Sponsor: ${input.sponsor}`,
    `Status: ${input.status}`,
  ].join("\n");
}

function problems({ summary, confidence }: Summary) {
  const found: string[] = [];
  const words = summary.trim().split(/\s+/).length;
  if (words < 15 || words > 60) found.push(`${words} words`);
  if (/["“”]/.test(summary)) found.push("contains quotation marks");
  if (/^\s*[-*#•]|\n/.test(summary)) found.push("contains headings, bullets or line breaks");
  if (OUTCOME_WORDS.test(summary)) found.push("states an outcome");
  if (confidence !== "high" && confidence !== "low") found.push("invalid confidence");
  return found;
}

let client: GoogleGenAI | undefined;

/** Asks Gemini for a summary, retrying up to 3 times when the reply breaks a rule. */
export async function generate(input: ItemInput): Promise<Summary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY must be set");
  client ??= new GoogleGenAI({ apiKey });

  let lastProblems: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: describe(input),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
      const result = JSON.parse(response.text ?? "") as Summary;
      lastProblems = problems(result);
      if (lastProblems.length === 0) return { ...result, summary: result.summary.trim() };
    } catch (error) {
      lastProblems = [error instanceof Error ? error.message : String(error)];
    }
  }
  throw new Error(`Summary rejected: ${lastProblems.join("; ")}`);
}
