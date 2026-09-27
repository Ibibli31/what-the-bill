/**
 * Gemini analysis of how one bill, motion, consultation or development application could be
 * relevant to a visitor, given the answers in their profile.
 * Server-only: it holds the Gemini API key.
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { Bill } from "@/lib/bill";
import { MAX_IMPACTS, parseImpacts, type PersonalizedImpact } from "@/lib/personalizedImpact";

if (typeof window !== "undefined") {
  throw new Error("lib/impacts is server-only: it holds the Gemini API key.");
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT = `You are analyzing a Canadian government item (a federal or Ontario bill, or an Ottawa council motion, consultation or development application) for a civic information application.

Your task is to identify potential ways this item could be relevant to the user based on their profile.

IMPORTANT:
- Be neutral and factual.
- Do not tell the user whether the item is good or bad.
- Do not recommend supporting or opposing the item.
- Do not persuade the user politically.
- Do not speculate about the user's political beliefs.
- Do not invent effects that are not supported by the item information.
- Only identify connections that can reasonably be derived from the item information.
- Use cautious language such as "could", "may", or "would apply if".
- Distinguish direct effects from possible indirect relevance.
- If there is no meaningful connection between the item and the user's profile, return an empty list.
- Keep each explanation concise: one or two sentences, under 60 words.
- Start each explanation with the profile answer it relates to, e.g. "You indicated that you rent."
- Use a short category name taken from the profile, such as Housing, Student, Employment, Industry, Transportation, Family or Age.
- Return at most ${MAX_IMPACTS} impacts. Plain text only: no markup, headings or bullet points.

Return ONLY valid JSON in this format:

{
  "impacts": [
    {
      "category": "Housing",
      "explanation": "You indicated that you rent. This bill proposes changes to rental housing regulations that could affect renters."
    }
  ]
}`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    impacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["category", "explanation"],
      },
    },
  },
  required: ["impacts"],
};

const KIND_NAMES: Record<Bill["kind"], string> = {
  bill: "bill",
  motion: "council motion",
  consultation: "public consultation",
  devApp: "development application",
};

/** Only the facts about the item that come from its source (plus its saved summaries). */
function billFacts(bill: Bill) {
  return {
    type: KIND_NAMES[bill.kind],
    level: bill.level,
    number: bill.number,
    title: bill.title,
    officialTitle: bill.officialTitle,
    status: bill.statusLabel,
    topics: bill.topics,
    details: Object.fromEntries(bill.facts.map((fact) => [fact.label, fact.value])),
    summary: bill.summary,
    officialSummary: bill.officialSummary,
    stages: bill.stages.filter((stage) => stage.done).map((stage) => stage.label),
    appliesTo: bill.wardNumber === null ? "city-wide or wider" : `Ottawa ward ${bill.wardNumber}`,
  };
}

let client: GoogleGenAI | undefined;

/** Asks Gemini how `bill` could affect someone with `profile`, retrying when the reply fails validation. */
export async function analyzeImpacts(
  bill: Bill,
  profile: Record<string, string | string[]>
): Promise<PersonalizedImpact[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY must be set");
  client ??= new GoogleGenAI({ apiKey });

  const contents = `User profile:\n${JSON.stringify(profile, null, 2)}\n\nBill information:\n${JSON.stringify(billFacts(bill), null, 2)}`;

  let lastProblem = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
      const impacts = parseImpacts(JSON.parse(response.text ?? ""));
      if (impacts) return impacts;
      lastProblem = "reply failed validation";
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`Impact analysis rejected: ${lastProblem}`);
}
