/**
 * Gemini plain-language summaries for bills, motions, consultations and development applications.
 * Server-only: it holds the Gemini API key.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { createHash } from "node:crypto";

if (typeof window !== "undefined") {
  throw new Error("lib/summarize is server-only: it holds the Gemini API key.");
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const MAX_ATTEMPTS = 3;
const MAX_DOCUMENT = 60_000;

export type ItemType = "motion" | "dev_app" | "consultation" | "provincial_bill" | "federal_bill";
export type SponsorKind = "government" | "ottawa_member" | "other_member" | "unknown";
export type Summary = { summary: string; confidence: "high" | "low"; evidence: string[] };

/** The facts about one item that the model is allowed to use. */
export type ItemInput = {
  itemType: ItemType;
  /** Bill, motion or application number; empty for consultations. */
  number: string;
  title: string;
  location: string;
  committee: string;
  sponsor: SponsorKind;
  status: string;
  /** Official document text (source_text). */
  document: string;
  /** True when source_text was already cut short at fetch time. */
  truncated: boolean;
};

const SYSTEM_PROMPT = `You write short, detailed plain-language summaries for StreetWatch Ottawa, a civic app that shows Ottawa residents what their city, province and country are doing. Many readers have never followed politics, and some read English as a second language.

The item has these fields, and any of them except Document may be empty: Type, Number, Title, Location or ward, Committee, Sponsor, Status, Document.
Sponsor is one of: government, ottawa_member, other_member, unknown.
Document is the official text: the bill itself, the council agenda item and motion, the development application's description, or the consultation page. It is your main source of facts. The Title is just a label; official titles are often slogans or vague. Status is background only; never mention it.

HOW TO START THE SUMMARY
Open with who is doing what, using the wording that fits the item:
- motion, Committee is City Council: "Council is being asked to…", or "Council is receiving an update on…" if the item only receives a report
- motion, any other committee: "[Committee] is being asked to…"
- dev_app: "An applicant is asking the City to…", then say what would be built, changed, split, or torn down, and where
- consultation: "The City wants to hear from residents about…"
- provincial_bill: "The Ontario government wants to…" (government), "An Ottawa MPP is proposing…" (ottawa_member), "An MPP is proposing…" (other_member), "A bill in the Ontario Legislature would…" (unknown)
- federal_bill: "The federal government wants to…" (government), "An Ottawa MP is proposing…" (ottawa_member), "An MP is proposing…" (other_member), "A bill in Parliament would…" (unknown). If the Number starts with S- and Sponsor is not government, use "A bill from the Senate would…"

WHAT TO INCLUDE
Sentence 1 states the main change or decision in concrete terms.
If the item changes or relies on a named law, program or term that most readers won't know (for example the Indian Act, the Official Plan, or Employment Insurance), make sentence 2 a background sentence that explains in plain words what it is and what it covers. Write at most one background sentence. It follows rule 8.
Then add 1-3 more sentences with the most useful specifics the Document gives, in this order of priority:
- dev_app: size and use (storeys, number of homes, shops, offices), what exists on the site now and whether it would be torn down, parking, trees, or other features the Document names
- motion: exactly what Council or staff would do, dollar amounts, places, deadlines, and who is affected
- consultation: the project and place, the options being considered, what residents are asked about, and the closing date if the Document gives one
- provincial_bill / federal_bill: the main changes, who they apply to, fines or amounts, and when they would start. For bills with many parts, name the 2-3 biggest changes
Each sentence must add a new fact. Skip anything the reader can't use.

RULES
1. Length: 2-5 sentences, 30-110 words. When the Document is thin, one sentence of 10-30 words is fine.
2. For a technical item, you may add a short "like…" list of real examples taken from the Document only.
3. You may end with a sentence starting "This matters because…" only when the Document itself states the effect on residents. Never speculate. That sentence needs its own evidence passage.
4. Use everyday words at a Grade 6-8 reading level. Explain or avoid jargon: say "the rules for what can be built" instead of "zoning by-law amendment," "the application" instead of "the file," "homes" instead of "units," and "vote" instead of "division." Spell out acronyms, except very common ones.
5. No filler. Don't write "aims to," "various," "a number of," "among other things," or "seeks to address." Name the actual things instead.
6. Stay neutral. Don't take sides, praise, or criticize. Ignore slogans in official titles ("Protecting Ontario by…") and describe the actual change. Apart from the openers above, do not name or describe the sponsor or party.
7. Describe the proposal, not the outcome. The app shows status separately, so never say whether it passed, failed, or became law.
8. Every fact about this item must come from the Document or the Location or ward field. Never fill gaps from the Title or general knowledge. Every number, date, dollar amount, place, street, and ward in your summary must appear in one of those two; if you can't find it there, leave it out. Write each number the way the Document writes it, as digits or as words. You may explain what a term means in general (for example, that minutes are the written record of a meeting).
   The one exception is the background sentence, which may use general knowledge, with these limits:
   - Say only what the law, program or term is, what it covers, and which government runs it. Keep it to basic facts that don't change.
   - No numbers, dates, dollar amounts, history, or debate about whether it is good or bad.
   - If you aren't sure what it is, leave the background sentence out rather than guess.
   If the Document is marked shortened, focus on the main purpose it states near the start.
9. Confidence: set "low" only when you cannot tell what the item would do (for example, a heading that doesn't say what is being decided). Routine items whose purpose is clear from their heading are "high".
10. No headings, bullet points, quotation marks, or preamble.
11. In evidence, give 1-4 short passages (4-40 words each) copied word for word from the Document that back up your summary, ideally one per sentence. The background sentence needs no evidence. Copy them exactly: a passage may start and end mid-sentence, but do not fix, skip, or join words. At least one must come from the body of the Document, not from the Title, unless the Document is only a heading. Passages must not overlap.

OUTPUT
Return only a JSON object with the keys "summary", "confidence" and "evidence". No other text.

EXAMPLES (invented)
Type: provincial_bill
Number: 45
Title: An Act to amend the Highway Traffic Act respecting speed limits near schools
Sponsor: other_member
Document:
EXPLANATORY NOTE
The Bill amends the Highway Traffic Act to set the maximum speed limit in school zones at 30 kilometres per hour. Fines for speeding in a school zone are doubled. Municipalities may install automated speed enforcement cameras in school zones. The amendments come into force on January 1, 2027.
Output: {"summary": "An MPP is proposing to set the top speed limit in school zones across Ontario at 30 kilometres per hour. Fines for speeding in these zones would double, and cities could put up speed cameras there. The changes would start on January 1, 2027.", "confidence": "high", "evidence": ["set the maximum speed limit in school zones at 30 kilometres per hour", "Fines for speeding in a school zone are doubled.", "The amendments come into force on January 1, 2027."]}

Type: federal_bill
Number: C-12
Title: An Act to amend the Indian Act (band by-laws)
Sponsor: government
Document:
SUMMARY
This enactment amends the Indian Act to allow the council of a band to make by-laws respecting the maintenance of roads and buildings on reserve lands without the approval of the Minister. It also requires the council to publish each by-law on the band's website within 30 days of it being made.
Output: {"summary": "The federal government wants to let First Nations band councils make local rules on the upkeep of roads and buildings on reserve lands without the federal Minister's approval. The Indian Act is the federal law that sets rules for First Nations status, band governments and reserve lands. Councils would have to post each new rule on the band's website within 30 days.", "confidence": "high", "evidence": ["allow the council of a band to make by-laws respecting the maintenance of roads and buildings on reserve lands without the approval of the Minister", "publish each by-law on the band's website within 30 days of it being made"]}

Type: motion
Number: 2026-41-02
Title: Agriculture and Rural Affairs Committee
Committee: Agriculture and Rural Affairs Committee
Document:
Agenda item 5.2: Rural Road Maintenance Service Standards
That the Agriculture and Rural Affairs Committee recommend Council approve service standards for grass cutting, ditching and gravel road grading in rural wards. Under the proposed standards, roadside grass will be cut twice per season and gravel roads will be graded at least three times per year. The standards will let residents know how often each type of maintenance will be done.
Output: {"summary": "The Agriculture and Rural Affairs Committee is being asked to recommend standards for rural road upkeep, like grass cutting, ditch work and gravel road grading. Roadside grass would be cut twice a season, and gravel roads graded at least three times a year. This matters because rural residents would know how often each kind of maintenance will be done.", "confidence": "high", "evidence": ["approve service standards for grass cutting, ditching and gravel road grading in rural wards", "roadside grass will be cut twice per season and gravel roads will be graded at least three times per year", "let residents know how often each type of maintenance will be done"]}

Type: dev_app
Number: D02-02-26-0001
Title: Zoning By-law Amendment
Location or ward: 123 Example St, Ward 14
Document:
Application D02-02-26-0001: Zoning By-law Amendment
Address: 123 Example Street
To permit a 12-storey residential building with 140 units and ground-floor retail. The existing two-storey commercial building would be demolished. 95 parking spaces are proposed in an underground garage.
Output: {"summary": "An applicant is asking the City to change the rules for what can be built at 123 Example Street to allow a 12-storey building with 140 homes and shops on the ground floor. The two-storey commercial building there now would be torn down. The plan includes 95 underground parking spaces.", "confidence": "high", "evidence": ["To permit a 12-storey residential building with 140 units and ground-floor retail.", "The existing two-storey commercial building would be demolished.", "95 parking spaces are proposed in an underground garage."]}

Type: consultation
Title: Example Park Renewal
Location or ward: Ward 7
Document:
The City is planning new playground equipment and a splash pad at Example Park and wants to hear which features matter most. Option A places the splash pad near the park entrance; Option B places it beside the sports field. The survey is open until October 15, 2026.
Output: {"summary": "The City wants to hear from residents about new playground equipment and a splash pad at Example Park. One option puts the splash pad near the park entrance, and the other puts it beside the sports field. The survey is open until October 15, 2026.", "confidence": "high", "evidence": ["planning new playground equipment and a splash pad at Example Park", "Option A places the splash pad near the park entrance; Option B places it beside the sports field.", "The survey is open until October 15, 2026."]}

Type: motion
Number: 2026-40-01
Title: City Council
Committee: City Council
Document:
Agenda item 3.1: Confirmation of Minutes
Output: {"summary": "Council is being asked to confirm the minutes, the written record of what happened at an earlier meeting.", "confidence": "high", "evidence": ["Agenda item 3.1: Confirmation of Minutes"]}

Type: motion
Number: 2026-40-07
Title: City Council
Committee: City Council
Document:
Agenda item 6.4: Report from the General Manager
Output: {"summary": "Council is being asked to consider a report from the General Manager.", "confidence": "low", "evidence": ["Agenda item 6.4: Report from the General Manager"]}`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["high", "low"] },
    evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["summary", "confidence", "evidence"],
};

const OUTCOME_WORDS = /\b(passed|failed|defeated|became law|was carried|was approved)\b/i;
const FILLER_WORDS = /\b(aims to|various|a number of|among other things|seeks to address)\b/i;

/** The part of the document the model is shown. */
const shownDocument = (input: ItemInput) => input.document.slice(0, MAX_DOCUMENT);

/** The model-facing text for an item. */
export function describe(input: ItemInput) {
  const shortened = input.truncated || input.document.length > MAX_DOCUMENT;
  return [
    `Type: ${input.itemType}`,
    `Number: ${input.number}`,
    `Title: ${input.title}`,
    `Location or ward: ${input.location}`,
    `Committee: ${input.committee}`,
    `Sponsor: ${input.sponsor}`,
    `Status: ${input.status}`,
    `Document${shortened ? " (shortened; the full text is longer)" : ""}:`,
    shownDocument(input),
  ].join("\n");
}

/** Short hash of the model and prompt, saved with each summary. */
export const SUMMARY_VERSION = createHash("sha256").update(`${MODEL}\n${SYSTEM_PROMPT}`).digest("hex").slice(0, 12);

/** Hash of the model, prompt and input; a saved summary with a different hash is regenerated. */
export const sourceHash = (input: ItemInput) =>
  createHash("sha256").update(`${MODEL}\n${SYSTEM_PROMPT}\n${describe(input)}`).digest("hex");

/** Lowercase text with quotes, dashes, invisible characters and whitespace made uniform. */
const normalize = (text: string) =>
  text
    .replace(/[​-‍﻿]/g, "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Reasons the evidence doesn't prove the summary came from the document; empty when it does. */
export function evidenceProblems(evidence: unknown, document: string, title: string) {
  if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 4) return ["evidence must hold 1-4 passages"];
  const found: string[] = [];
  const source = normalize(document);
  const label = normalize(title);
  const quotes = evidence.map((passage) => normalize(String(passage)));
  for (const quote of quotes) {
    const words = quote.split(" ").length;
    if (words < 4 || words > 40) found.push(`evidence passage has ${words} words`);
    else if (!source.includes(quote)) found.push(`evidence passage not found in the Document: ${quote.slice(0, 80)}`);
  }
  if (quotes.every((quote) => label.includes(quote))) found.push("all evidence comes from the Title");
  const spans = quotes
    .map((quote) => [source.indexOf(quote), source.indexOf(quote) + quote.length])
    .filter(([start]) => start >= 0);
  if (spans.some(([start, end], i) => spans.some(([otherStart, otherEnd], j) => i < j && start < otherEnd && otherStart < end))) {
    found.push("evidence passages overlap");
  }
  return found;
}

/** Digits with thousands separators removed, e.g. "$4,000" → "$4000". */
const joinThousands = (text: string) => text.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");

/** Numbers in the summary that appear in neither the document nor the location. */
export function unsupportedNumbers(summary: string, document: string, location: string) {
  const source = joinThousands(normalize(`${document}\n${location}`));
  const numbers = joinThousands(summary).match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(numbers)].filter((number) => {
    const escaped = number.replace(".", "\\.");
    return !new RegExp(`(?<!\\d|\\d\\.)${escaped}(?!\\d|\\.\\d)`).test(source);
  });
}

/** Reasons a summary breaks the rules; empty when it passes. */
export function problems({ summary, confidence, evidence }: Summary, input: ItemInput) {
  const found: string[] = [];
  const words = summary.trim().split(/\s+/).length;
  if (words < 10 || words > 110) found.push(`${words} words`);
  const sentences = summary.trim().split(/[.!?](?:\s+|$)/).filter(Boolean).length;
  if (sentences > 5) found.push(`${sentences} sentences`);
  if (/["“”]/.test(summary)) found.push("contains quotation marks");
  if (/^\s*[-*#•]|\n/.test(summary)) found.push("contains headings, bullets or line breaks");
  if (OUTCOME_WORDS.test(summary)) found.push("states an outcome");
  if (FILLER_WORDS.test(summary)) found.push(`uses filler: ${FILLER_WORDS.exec(summary)?.[0]}`);
  if (confidence !== "high" && confidence !== "low") found.push("invalid confidence");
  const unsupported = unsupportedNumbers(summary, shownDocument(input), input.location);
  if (unsupported.length) found.push(`numbers not in the Document: ${unsupported.join(", ")}`);
  return [...found, ...evidenceProblems(evidence, shownDocument(input), input.title)];
}

let client: GoogleGenAI | undefined;

/** Asks Gemini for a summary, retrying up to 3 times with the reasons when the reply breaks a rule. */
export async function generate(input: ItemInput): Promise<Summary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY must be set");
  client ??= new GoogleGenAI({ apiKey });

  let lastProblems: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const feedback = lastProblems.length ? `\n\nYour previous answer was rejected: ${lastProblems.join("; ")}` : "";
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: describe(input) + feedback,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
      const result = JSON.parse(response.text ?? "") as Summary;
      lastProblems = problems(result, input);
      if (lastProblems.length === 0) return { ...result, summary: result.summary.trim() };
    } catch (error) {
      lastProblems = [error instanceof Error ? error.message : String(error)];
    }
  }
  throw new Error(`Summary rejected: ${lastProblems.join("; ")}`);
}
