import { GoogleGenAI, Type } from "@google/genai";
import { createHash } from "node:crypto";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } = process.env;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const DELAY_MS = 700;
const MAX_ATTEMPTS = 3;
const MAX_DOCUMENT = 20_000;

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY })) {
  if (!value) throw new Error(`${name} must be set`);
}

const args = process.argv.slice(2);
const SAMPLE_RUN = args.includes("--sample");
const DRY_RUN = args.includes("--dry") || SAMPLE_RUN;
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const LIMIT = Number(option("--limit") ?? Infinity);
const ONLY = option("--only");

/** Fixed test set for --sample: primary keys per table, each a different kind of title. */
const SAMPLE = {
  federal_bills: [
    160, // C-264: vague title ("certain restrictions on shipping")
    61, // C-4: vague title ("and another measure")
    72, // C-15: budget bill, truncated
    26, // S-220: simple heritage-month bill
  ],
  provincial_bills: [
    7, // Bill 133: slogan acronym title
    32, // Bill 108: "Protecting Ontario by..." slogan title
    21, // Bill 119: slogan title, truncated
  ],
  motions: [
    11, // zoning report recommendation with concrete details
    8, // numbered amendment motion
    39, // minutes confirmation, heading only
  ],
  consultations: [
    6, // vague title ("Mobility dashboard")
    13, // vague title ("ByWard Square")
  ],
};

const SYSTEM_PROMPT = `You write plain-language titles for bills, council motions and public consultations in StreetWatch Ottawa, a civic app that shows Ottawa residents what their governments are doing. Many readers have never followed politics, and some read English as a second language.

Rewrite the item below as a short, clear title that says what it would actually DO.
The Document is the official text: the bill itself, the council agenda item and motion, or the consultation page. It is your only source of facts. The official title is just a label; official titles are often slogans or vague.

Levels: provincial = Ontario Legislature, federal = Parliament of Canada, municipal = City of Ottawa Council or a council committee.
A municipal "public consultation" is a City project where residents are asked for feedback.

RULES
1. Length: 5-12 words, no more than 85 characters.
2. Say what changes, and for whom if it matters. Start with a plain verb such as "Lets," "Requires," "Bans," "Raises," "Cuts," "Changes," "Creates," "Makes," or "Ends." For a public consultation, start with "Asks for feedback on" and name the project and place.
   Don't just reword the official title; readers see only your title. Add the most useful concrete detail from the Document that the official title leaves out: what exactly changes, for whom, where, or how much. If the Document adds nothing beyond the official title, keep the title short.
3. Use everyday words at a Grade 6-8 reading level. No legal jargon ("amend," "statute," "enact," "provisions," "whereas," "respecting"). Spell out acronyms except very common ones like GST or CPP.
   Keep the name of a law or program as written (for example "Indian Act"), but describe what it does in everyday words, as long as they mean the same thing as the Document.
4. Stay neutral. Ignore slogans in official titles ("Protecting Ontario by...", "Building a Stronger...") and describe the actual change. Do not use praising or criticizing words such as "protects," "finally," "fixes," "attacks," or "harmful."
5. Describe what is proposed, never whether it passed or how anyone voted. Do not use "new law" or "passed."
6. Name the specific subject the Document is about (for example "weights and measures," "railways," "Indian Act," "Oil Tanker Moratorium Act") instead of a broader term.
   If it covers 2-3 subjects, name them all. If it covers 4 or more unrelated subjects, follow rule 7.
   Use only the Document. Do not guess details it does not state, and never fill gaps from the title or general knowledge. Do not mention the sponsor or party.
7. If the Document covers too many unrelated things to name in one title (budget bills, "miscellaneous amendments"), name the 2-3 biggest measures it lists first, such as "Carries out budget measures on income tax, housing and pensions." Only when no measures stand out, use "Carries out the federal budget," "Carries out the Ontario budget" or "Makes small technical changes to several laws."
8. Common item types:
   - Bills that set a day, week or month: "Makes July Swahili Heritage Month in Ontario" (provincial) or "... across Canada" (federal)
   - "Framework" or "strategy" bills: say the government must make a plan, never "Creates." Use "Requires a national plan for X" (federal) or "Requires a provincial plan for X" (provincial).
   - Motions that only receive a report: "Shares a report on X"
   - Motions that direct staff: "Asks City staff to study X" or "Asks City staff to report on X"
   - Notices of motion: title the motion itself, as if it were being voted on
9. Confidence: set "low" if the Document is too thin to tell what the item does (for example, only a heading). Otherwise set "high."
10. No ending period, no quotation marks, sentence case: capitalize only the first word and proper nouns.
11. In evidence, give 1-3 short passages (4-20 words each) copied word for word from the Document that back up your title. Copy them exactly: a passage may start and end mid-sentence, but do not fix, skip, or join words. At least one must come from the body of the Document, not from the official title. Passages must not overlap; choose passages that back up different parts of your title.

OUTPUT
Return only a JSON object with the keys "plain_title", "confidence" and "evidence". No other text.

EXAMPLES (invented)
Level: provincial
Official title: An Act to amend the Employment Standards Act, 2000 respecting leaves of absence
Document:
EXPLANATORY NOTE
The Bill amends the Employment Standards Act, 2000 to give employees up to 10 days of unpaid leave following a miscarriage or stillbirth.
Output: {"plain_title": "Gives workers up to 10 unpaid days off after miscarriage or stillbirth", "confidence": "high", "evidence": ["give employees up to 10 days of unpaid leave following a miscarriage or stillbirth"]}

Level: provincial
Official title: An Act to amend the Highway Traffic Act respecting speed limits near schools
Document:
EXPLANATORY NOTE
The Bill amends the Highway Traffic Act to set the maximum speed limit in school zones at 30 kilometres per hour.
Output: {"plain_title": "Sets a 30 km/h speed limit in school zones", "confidence": "high", "evidence": ["amends the Highway Traffic Act to set the maximum speed limit in school zones at 30 kilometres per hour"]}

Level: provincial
Official title: Building a Stronger Province Act, 2026
Document:
EXPLANATORY NOTE
Schedule 1 amends the Assessment Act. Schedule 2 amends the Mining Act. Schedule 3 amends the Retail Sales Tax Act.
Output: {"plain_title": "Changes tax, property assessment and mining laws", "confidence": "high", "evidence": ["Schedule 1 amends the Assessment Act.", "Schedule 2 amends the Mining Act."]}

Level: municipal
Committee: Planning and Housing Committee
Document:
Agenda item 4.1: Zoning By-law Amendment - 123 Example Street
That Planning and Housing Committee recommend Council approve an amendment to the Zoning By-law to permit a 12-storey apartment building.
Output: {"plain_title": "Allows a 12-storey apartment building at 123 Example St", "confidence": "high", "evidence": ["approve an amendment to the Zoning By-law to permit a 12-storey apartment building"]}

Level: municipal
Committee: Transportation Committee
Document:
Agenda item 7.2: Motion - Winter Sidewalk Clearing on Example Avenue
Therefore be it resolved that Transportation Committee recommend Council direct staff to review winter sidewalk clearing standards on Example Avenue and report back by the second quarter of 2027.
Output: {"plain_title": "Asks City staff to review winter sidewalk clearing on Example Avenue", "confidence": "high", "evidence": ["direct staff to review winter sidewalk clearing standards on Example Avenue"]}

Level: municipal
Type: public consultation
Title: Example Park Renewal
Document:
The City is planning new playground equipment and a splash pad at Example Park and wants to hear which features matter most.
Output: {"plain_title": "Asks for feedback on new playground and splash pad at Example Park", "confidence": "high", "evidence": ["planning new playground equipment and a splash pad at Example Park"]}`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    plain_title: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["high", "low"] },
    evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["plain_title", "confidence", "evidence"],
};

const meaningful = (values) => values?.filter((value) => value !== "Other");

const titleCase = (text) => text.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, gap, letter) => gap + letter.toUpperCase());

const DEV_APP_TITLES = {
  "Zoning By-law Amendment": "Zoning change proposed",
  "Official Plan Amendment": "City land-use plan change proposed",
  "Site Plan Control": "Building and site plans",
  "Plan of Subdivision": "Land subdivision plan",
};

function devAppTitle(row) {
  const addresses = (row.address ?? "").split(";").map((part) => part.trim()).filter(Boolean);
  const others = addresses.length - 1;
  const extra = others > 0 ? ` and ${others} nearby ${others === 1 ? "address" : "addresses"}` : "";
  const place = addresses.length ? `at ${titleCase(addresses[0])}${extra}` : "across the city";
  return { plain_title: `${DEV_APP_TITLES[row.application_type] ?? row.application_type} ${place}`, confidence: "high" };
}

const list = (values) => (values?.length ? values.join(", ") : "none");
const hash = (text) => createHash("sha256").update(text).digest("hex");
/** Short hash of the model and prompt, saved with each Gemini title. */
const TITLE_VERSION = hash(`${MODEL}\n${SYSTEM_PROMPT}`).slice(0, 12);

/** The part of the document the model is shown, labelled when it is cut short. */
function documentBlock(row) {
  const shortened = row.source_text_truncated || row.source_text.length > MAX_DOCUMENT;
  return `Document${shortened ? " (shortened; the full text is longer)" : ""}:\n${row.source_text.slice(0, MAX_DOCUMENT)}`;
}

const SOURCES = [
  {
    table: "federal_bills",
    pk: "bill_id",
    select: "bill_id,number_code,title,topic_tags,is_government_bill,plain_title,plain_title_source,plain_title_version,source_text,source_text_truncated",
    officialTitle: (row) => row.title,
    describe: (row) =>
      `Level: federal\nNumber: Bill ${row.number_code}\nOfficial title: ${row.title}\nTopics: ${list(meaningful(row.topic_tags))}\nGovernment bill: ${row.is_government_bill}\n${documentBlock(row)}`,
  },
  {
    table: "provincial_bills",
    pk: "bill_id",
    select: "bill_id,bill_number,title,topic_tags,is_government_bill,plain_title,plain_title_source,plain_title_version,source_text,source_text_truncated",
    officialTitle: (row) => row.title,
    describe: (row) =>
      `Level: provincial\nNumber: Bill ${row.bill_number}\nOfficial title: ${row.title}\nTopics: ${list(meaningful(row.topic_tags))}\nGovernment bill: ${row.is_government_bill}\n${documentBlock(row)}`,
  },
  {
    table: "motions",
    pk: "motion_id",
    select: "motion_id,motion_number,tags,plain_title,plain_title_source,plain_title_version,source_text,source_text_truncated,meetings(committee_name)",
    officialTitle: (row) => row.meetings?.committee_name ?? "",
    describe: (row) =>
      `Level: municipal\nNumber: Motion ${row.motion_number}\nCommittee: ${row.meetings?.committee_name ?? "unknown"}\nTopics: ${list(meaningful(row.tags))}\n${documentBlock(row)}`,
  },
  {
    table: "consultations",
    pk: "consultation_id",
    select: "consultation_id,title,plain_title,plain_title_source,plain_title_version,source_text,source_text_truncated",
    officialTitle: (row) => row.title,
    describe: (row) => `Level: municipal\nType: public consultation\nTitle: ${row.title}\n${documentBlock(row)}`,
  },
  {
    table: "dev_apps",
    pk: "app_id",
    select: "app_id,file_number,address,application_type,plain_title,plain_title_source,plain_title_version",
    source: (row) => `${row.application_type}|${row.address ?? ""}`,
    local: devAppTitle,
  },
];

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function supabase(path, init) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: supabaseHeaders });
  if (!response.ok) throw new Error(`Supabase ${path} responded ${response.status}: ${await response.text()}`);
  return init?.method === "PATCH" ? null : response.json();
}

/** Lowercase text with quotes, dashes, invisible characters and whitespace made uniform. */
const normalize = (text) =>
  text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Reasons the evidence doesn't prove the title came from the document; empty when it does. */
function evidenceProblems(evidence, document, officialTitle) {
  if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 3) return ["evidence must hold 1-3 passages"];
  const found = [];
  const source = normalize(document);
  const label = normalize(officialTitle);
  for (const quote of evidence.map((passage) => normalize(String(passage)))) {
    const words = quote.split(" ").length;
    if (words < 4 || words > 20) found.push(`evidence passage has ${words} words`);
    else if (!source.includes(quote)) found.push(`evidence passage not found in the Document: ${quote.slice(0, 80)}`);
  }
  if (evidence.every((passage) => label.includes(normalize(String(passage))))) found.push("all evidence comes from the official title");
  const spans = evidence
    .map((passage) => normalize(String(passage)))
    .map((quote) => [source.indexOf(quote), source.indexOf(quote) + quote.length])
    .filter(([start]) => start >= 0);
  if (spans.some(([start, end], i) => spans.some(([otherStart, otherEnd], j) => i < j && start < otherEnd && otherStart < end))) {
    found.push("evidence passages overlap");
  }
  return found;
}

function problems({ plain_title: title, confidence, evidence }, row, officialTitle) {
  const found = [];
  const words = title.trim().split(/\s+/).length;
  if (words < 5 || words > 12) found.push(`${words} words`);
  if (title.length > 85) found.push(`${title.length} characters`);
  if (/[.\s]$/.test(title)) found.push("ends with a period or space");
  if (/["“”]/.test(title)) found.push("contains quotation marks");
  if (confidence !== "high" && confidence !== "low") found.push("invalid confidence");
  return [...found, ...evidenceProblems(evidence, row.source_text.slice(0, MAX_DOCUMENT), officialTitle(row))];
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/** Asks Gemini for a title, retrying up to 3 times with the reasons when the reply breaks a rule. */
async function generate(row, describe, officialTitle) {
  let lastProblems = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const feedback = lastProblems.length ? `\n\nYour previous answer was rejected: ${lastProblems.join("; ")}` : "";
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: describe(row) + feedback,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
      const result = JSON.parse(response.text);
      lastProblems = problems(result, row, officialTitle);
      if (lastProblems.length === 0) return result;
    } catch (error) {
      lastProblems = [String(error.message ?? error)];
    }
    await sleep(DELAY_MS * attempt);
  }
  throw new Error(lastProblems.join("; "));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let done = 0;
let failed = 0;
let streak = 0;
const MAX_FAILURE_STREAK = 3;

for (const { table, pk, select, source, describe, officialTitle, local } of SOURCES) {
  if (ONLY && ONLY !== table) continue;
  if (SAMPLE_RUN && !SAMPLE[table]) continue;
  const sourceOf = source ?? ((row) => hash(`${MODEL}\n${SYSTEM_PROMPT}\n${describe(row)}`));
  const sampleFilter = SAMPLE_RUN ? `&${pk}=in.(${SAMPLE[table].join(",")})` : "";
  const rows = await supabase(`${table}?select=${select}&order=${pk}${sampleFilter}`);
  const withDocument = local ? rows : rows.filter((row) => row.source_text);
  const pending = SAMPLE_RUN
    ? withDocument
    : withDocument.filter((row) => !row.plain_title || row.plain_title_source !== sourceOf(row));
  const versionOf = local ? "template" : TITLE_VERSION;
  const unversioned = withDocument.filter(
    (row) => row.plain_title && row.plain_title_source === sourceOf(row) && row.plain_title_version !== versionOf
  );
  if (!DRY_RUN && unversioned.length) {
    for (let start = 0; start < unversioned.length; start += 200) {
      const ids = unversioned.slice(start, start + 200).map((row) => row[pk]);
      await supabase(`${table}?${pk}=in.(${ids.join(",")})`, {
        method: "PATCH",
        body: JSON.stringify({ plain_title_version: versionOf }),
      });
    }
    console.log(`${table}: stamped version ${versionOf} on ${unversioned.length} current titles`);
  }
  console.log(
    SAMPLE_RUN
      ? `\n=== ${table}: ${pending.length} sample items`
      : `${table}: ${pending.length} of ${rows.length} need a title (${rows.length - withDocument.length} have no document)`
  );

  let tableCount = 0;
  for (const row of pending) {
    if (tableCount >= LIMIT) break;
    if (streak >= MAX_FAILURE_STREAK) break;
    tableCount++;
    const label = `${table} ${row[pk]}`;
    try {
      const { plain_title, confidence, evidence } = local ? local(row) : await generate(row, describe, officialTitle);
      console.log(`\n${label} [${confidence}] ${plain_title}`);
      if (DRY_RUN) {
        console.log(`    was: ${row.plain_title ?? "(none)"}`);
        evidence?.forEach((passage) => console.log(`    evidence: ${passage}`));
      }
      if (!DRY_RUN) {
        await supabase(`${table}?${pk}=eq.${row[pk]}`, {
          method: "PATCH",
          body: JSON.stringify({
            plain_title,
            plain_title_confidence: confidence,
            plain_title_source: sourceOf(row),
            plain_title_version: versionOf,
          }),
        });
      }
      done++;
      streak = 0;
    } catch (error) {
      failed++;
      streak++;
      console.error(`\n${label} skipped: ${error.message}`);
    }
    await sleep(DELAY_MS);
  }
}

if (streak >= MAX_FAILURE_STREAK) console.error(`Stopped after ${streak} failures in a row`);
console.log(`${DRY_RUN ? "Dry run: " : ""}${done} titled, ${failed} skipped`);
