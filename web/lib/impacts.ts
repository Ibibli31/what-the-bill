/**
 * Gemini analysis of how one bill, motion, consultation or development application could be
 * relevant to a visitor, given the answers in their profile.
 * Server-only: it holds the Gemini API key.
 */
import { GoogleGenAI, Type } from "@google/genai";
import type { Bill } from "@/lib/bill";
import { MAX_IMPACTS, parseImpacts, type PersonalizedImpact } from "@/lib/personalizedImpact";
import { PROFILE_LABELS } from "@/lib/profile";
import { evidenceProblems, OUTCOME_WORDS, unsupportedNumbers } from "@/lib/summarize";

if (typeof window !== "undefined") {
  throw new Error("lib/impacts is server-only: it holds the Gemini API key.");
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const MAX_ATTEMPTS = 3;
const MAX_DOCUMENT = 60_000;

const CATEGORIES = Object.values(PROFILE_LABELS).join(", ");

const SYSTEM_PROMPT = `You find personal connections between one government item and one visitor's profile for StreetWatch Ottawa, a civic app that shows Ottawa residents what their city, province and country are doing. Many readers have never followed politics, and some read English as a second language.

INPUTS
Profile: a JSON object of the visitor's answers. Each key is a category and each value is their answer; "Family / caregiver" holds a list. Categories the visitor skipped are left out. The possible categories are: ${CATEGORIES}.
Item: Type, Number, Title and Document. Document is the official text: the bill itself, the council agenda item and motion, the development application's description, or the consultation page. It is your only source of facts about the item. The Title is just a label; official titles are often slogans or vague.

WHAT COUNTS AS A CONNECTION
A connection exists only when the Document names a group, situation or thing that matches one of the visitor's answers, or offers support to people in a hard situation. There are three kinds:
- direct: the Document names the visitor's group, in any wording, as the people it applies to. Example: the Document changes rules for tenants, and the visitor rents.
- indirect: the Document applies to something the visitor's answer shows they use or depend on, but names a different group as its target. Example: the Document sets rules for child care centres, and the visitor has children.
- situational: the Document offers money, services or support to people in a situation the Profile can't show, such as a flood, fire or other disaster, losing a job, an illness or injury, or being a victim of a crime. Example: the Document funds a charity that helps residents whose homes flooded. Use category "Situation".
Many items have no personal connection, and an empty list is the right answer then. But when the Document names a group that matches an answer, include it.

MATCH ON MEANING, NOT EXACT WORDS
Documents use legal or official words for groups. Match them to the visitor's answers by meaning, for example:
- Housing: Rent means tenants, renters, rental units or residential tenancies. Own means homeowners, property owners or property tax.
- Student status: students, learners, schools, colleges, universities, tuition. A student loan counts only if the visitor is a student.
- Employment status: Full-time or Part-time means employees or workers. Self-employed means self-employed people, sole proprietors or independent contractors. Unemployed means job seekers, Employment Insurance or job training. Retired means retirees, pensioners or pensions.
- Occupation / industry: workers or businesses in that industry, like nurses and hospitals for Healthcare, or builders and contractors for Trades / Construction.
- Transportation: Personal vehicle means drivers, motorists, vehicle owners, driver's licences or parking. Public transit means transit riders, OC Transpo, buses, the O-Train or fares. Bicycle means cyclists or bike lanes. Walking means pedestrians or sidewalks. Rideshare / Taxi means taxi or ride-hailing passengers.
- Family / caregiver: I have children means parents, children, child care or child benefits. Caring for an elderly family member means caregivers, seniors, long-term care or home care. Caring for someone with a disability means caregivers, people with disabilities or disability supports.
- Age range: only when the Document names an age group, such as seniors, youth, or people 65 and over.

RULES
1. Every connection must rest on words in the Document. Never fill gaps from the Title or general knowledge, and never build a chain of effects the Document doesn't state (for example, road repairs lead to less traffic, which leads to a shorter commute).
2. Don't stereotype. Connect an answer only when the Document names that group, in any wording. Being 18–24 doesn't make someone a student, and being 65+ doesn't make them retired.
3. Leave location out. The app matches items to wards on its own. An item about one street, site, park or building connects only through where the visitor lives, so return an empty list for it unless the Document also names a profile group or offers support to people in a situation.
4. For direct and indirect connections, set category to the exact Profile category of the answer the connection uses. Use each category at most once. Return at most one situational connection, and only when the Document says what support people get or who gives it; rules or fines for people in a situation don't count.
5. Return at most ${MAX_IMPACTS} impacts: direct first, then indirect, then situational.
6. Explanation: 1-2 sentences, under 60 words. Don't retell the whole item; the app shows a summary separately.
   - direct or indirect: start by naming the answer, like "You said you rent." Then say what in the Document applies to the visitor.
   - situational: start with "If you" and the situation, like "If your home was damaged by the flood," then say what support the Document offers and who gives it. Never assume the visitor is in that situation.
7. Use "would" for direct connections, since the Document states the effect. Use "may" or "could" for indirect and situational ones. Don't stack hedges.
8. Stay neutral. Don't take sides or say whether the item is good or bad for the visitor, and never guess their politics. Describing support the Document offers is fine. Don't use words like benefit, help, hurt, harm, burden, relief, unfair, "save you" or "cost you" unless the Document uses that exact word.
9. Describe the proposal, not the outcome. Never say whether it passed, failed or became law.
10. Use everyday words at a Grade 6-8 reading level. Explain or avoid jargon, and spell out acronyms except very common ones. Plain text only: no markup, headings or bullet points.
11. Every number, date and dollar amount in an explanation must appear in the Document, written the same way.
12. Evidence: one passage of 4-40 words copied word for word from the Document that names the matching group, situation or thing. Copy it exactly: it may start and end mid-sentence, but don't fix, skip or join words. It must come from the body of the Document, not the Title.

OUTPUT
Return only a JSON object with the key "impacts": a list where each entry has "category", "relevance" ("direct", "indirect" or "situational"), "explanation" and "evidence". When there is no connection, return {"impacts": []}.

EXAMPLES (invented)
Profile: {"Age range": "25–34", "Housing": "Rent", "Transportation": "Public transit"}
Type: Ontario bill
Number: Bill 88
Title: Fair Rent Act
Document:
EXPLANATORY NOTE
The Bill amends the Residential Tenancies Act, 2006 to require landlords to give tenants at least 120 days' written notice of a rent increase. Landlords who fail to give notice may be fined up to $5,000.
Output: {"impacts": [{"category": "Housing", "relevance": "direct", "explanation": "You said you rent. Your landlord would have to tell you in writing at least 120 days before raising your rent.", "evidence": "require landlords to give tenants at least 120 days' written notice of a rent increase"}]}
(Age range and Transportation are left out: the Document names neither.)

Profile: {"Employment status": "Full-time", "Family / caregiver": ["I have children"]}
Type: Ottawa council motion
Number: Motion 2026-12-03
Title: Community Services Committee
Document:
Agenda item 4.1: Child Care Fee Transparency
That Council direct staff to require all City-funded child care centres to post their daily fees on the City's website by June 1, 2027.
Output: {"impacts": [{"category": "Family / caregiver", "relevance": "indirect", "explanation": "You said you have children. If you use a City-funded child care centre, you may be able to see its daily fees on the City's website by June 1, 2027.", "evidence": "require all City-funded child care centres to post their daily fees on the City's website"}]}

Profile: {"Housing": "Own", "Transportation": "Personal vehicle"}
Type: Ottawa council motion
Number: Motion 2026-15-02
Title: Public Works and Infrastructure Committee
Document:
Agenda item 5.3: Example Road Resurfacing
That the Committee recommend Council approve $2.4 million to resurface Example Road between Main Street and Park Avenue in 2027.
Output: {"impacts": []}
(The Document names no group of people, and one road connects only through location.)

Profile: {"Age range": "18–24", "Student status": "No", "Employment status": "Part-time"}
Type: federal bill
Number: C-31
Title: An Act to amend the Canada Student Financial Assistance Act
Document:
SUMMARY
This enactment amends the Canada Student Financial Assistance Act to raise the income threshold under which borrowers do not need to repay their Canada Student Loans.
Output: {"impacts": []}
(The Document names student loan borrowers. Nothing in the Profile says the visitor has a student loan, and their age alone doesn't.)

Profile: {"Housing": "Own", "Employment status": "Retired"}
Type: Ontario bill
Number: Bill 112
Title: Wildfire Recovery Act, 2026
Document:
EXPLANATORY NOTE
The Bill establishes the Wildfire Recovery Fund. The Fund provides grants of up to $10,000 to households whose principal residence was damaged by a wildfire, to pay for repairs and temporary housing.
Output: {"impacts": [{"category": "Situation", "relevance": "situational", "explanation": "If your home is ever damaged by a wildfire, your household could apply for a provincial grant of up to $10,000 for repairs and temporary housing.", "evidence": "grants of up to $10,000 to households whose principal residence was damaged by a wildfire"}]}
(The Document names households hit by a wildfire, not homeowners or retirees as a group, so Housing and Employment status are left out.)`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    impacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          relevance: { type: Type.STRING, enum: ["direct", "indirect", "situational"] },
          explanation: { type: Type.STRING },
          evidence: { type: Type.STRING },
        },
        required: ["category", "relevance", "explanation", "evidence"],
      },
    },
  },
  required: ["impacts"],
};

const SITUATION = "Situation";
const ORDER: Record<PersonalizedImpact["relevance"], number> = { direct: 0, indirect: 1, situational: 2 };

/** Praise or blame wording, allowed only when the Document uses the same word. */
const PRAISE_BLAME = /\b(benefit\w*|help\w*|hurt\w*|harm\w*|burden\w*|relief|unfair\w*|save you|cost you)\b/gi;

/** The item's type as the model sees it, e.g. "Ontario bill". */
function typeName(bill: Bill) {
  if (bill.kind === "bill") return bill.level === "provincial" ? "Ontario bill" : "federal bill";
  if (bill.kind === "motion") return "Ottawa council motion";
  if (bill.kind === "consultation") return "City of Ottawa public consultation";
  return "Ottawa development application";
}

/** The model-facing text for a profile and item. */
function describe(bill: Bill, document: string, truncated: boolean, profile: Record<string, string | string[]>) {
  const shortened = truncated || document.length > MAX_DOCUMENT;
  return [
    `Profile: ${JSON.stringify(profile)}`,
    `Type: ${typeName(bill)}`,
    `Number: ${bill.number}`,
    `Title: ${bill.officialTitle}`,
    `Document${shortened ? " (shortened; the full text is longer)" : ""}:`,
    document.slice(0, MAX_DOCUMENT),
  ].join("\n");
}

/** Reasons the impacts break the rules; empty when they pass. */
function problems(
  impacts: PersonalizedImpact[],
  document: string,
  title: string,
  profile: Record<string, string | string[]>
) {
  const found: string[] = [];
  const categories = Object.keys(profile);
  const answers = Object.values(profile).flat().join("\n");
  const source = document.toLowerCase();
  const used = new Set<string>();
  if (impacts.filter((impact) => impact.relevance === "situational").length > 1) found.push("more than one situational");
  for (const { category, relevance, explanation, evidence } of impacts) {
    if (relevance === "situational") {
      if (category !== SITUATION) found.push(`situational category must be "${SITUATION}"`);
      if (!/^if you\b/i.test(explanation)) found.push(`situational explanation must start with "If you"`);
    } else if (!categories.includes(category)) found.push(`category "${category}" is not in the Profile`);
    else if (used.has(category)) found.push(`category "${category}" is used twice`);
    used.add(category);
    if (OUTCOME_WORDS.test(explanation)) found.push("states an outcome");
    const unsupported = unsupportedNumbers(explanation, document, answers);
    if (unsupported.length) found.push(`numbers not in the Document: ${unsupported.join(", ")}`);
    const loaded = (explanation.match(PRAISE_BLAME) ?? []).filter((word) => !source.includes(word.toLowerCase()));
    if (loaded.length) found.push(`takes a side: ${loaded.join(", ")}`);
    found.push(...evidenceProblems([evidence], document, title));
  }
  return found;
}

let client: GoogleGenAI | undefined;

/** Asks Gemini how `bill` could affect someone with `profile`, retrying with the reasons when the reply breaks a rule. */
export async function analyzeImpacts(
  bill: Bill,
  document: string,
  truncated: boolean,
  profile: Record<string, string | string[]>
): Promise<PersonalizedImpact[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY must be set");
  client ??= new GoogleGenAI({ apiKey });

  const shown = document.slice(0, MAX_DOCUMENT);
  const contents = describe(bill, document, truncated, profile);

  let lastProblems: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const feedback = lastProblems.length ? `\n\nYour previous answer was rejected: ${lastProblems.join("; ")}` : "";
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: contents + feedback,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
      const impacts = parseImpacts(JSON.parse(response.text ?? ""));
      lastProblems = impacts ? problems(impacts, shown, bill.officialTitle, profile) : ["reply was not valid impacts JSON"];
      if (impacts && lastProblems.length === 0) {
        return [...impacts].sort((a, b) => ORDER[a.relevance] - ORDER[b.relevance]);
      }
    } catch (error) {
      lastProblems = [error instanceof Error ? error.message : String(error)];
    }
  }
  throw new Error(`Impact analysis rejected: ${lastProblems.join("; ")}`);
}
