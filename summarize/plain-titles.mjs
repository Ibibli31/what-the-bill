import { GoogleGenAI, Type } from "@google/genai";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } = process.env;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const DELAY_MS = 700;
const MAX_ATTEMPTS = 3;

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY })) {
  if (!value) throw new Error(`${name} must be set`);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry");
const limitIndex = args.indexOf("--limit");
const LIMIT = limitIndex === -1 ? Infinity : Number(args[limitIndex + 1]);

const SYSTEM_PROMPT = `You write plain-language titles for bills and council motions in StreetWatch Ottawa, a civic app that shows Ottawa residents what their governments are doing. Many readers have never followed politics, and some read English as a second language.

Rewrite the item below as a short, clear title that says what it would actually DO.

Levels: provincial = Ontario Legislature, federal = Parliament of Canada, municipal = City of Ottawa Council or a council committee.
A municipal "public consultation" is a City project where residents are asked for feedback.

RULES
1. Length: 5-12 words, no more than 85 characters.
2. Say what changes, and for whom if it matters. Start with a plain verb such as "Lets," "Requires," "Bans," "Raises," "Cuts," "Changes," "Creates," or "Ends." For a public consultation, start with "Asks for feedback on" and name the project and place.
3. Use everyday words at a Grade 6-8 reading level. No legal jargon ("amend," "statute," "enact," "provisions," "whereas," "respecting"). Spell out acronyms except very common ones like GST or CPP.
4. Stay neutral. Ignore slogans in official titles ("Protecting Ontario by...", "Building a Stronger...") and describe the actual change. Do not use praising or criticizing words such as "protects," "finally," "fixes," "attacks," or "harmful."
5. Describe what is proposed, never whether it passed or how anyone voted. Do not use "new law" or "passed."
6. Keep the specific subject named in the official title (for example "weights and measures," "railways," "Indian Act") instead of replacing it with a broader term. If the title names two or more subjects, name them all.
   For "framework" bills, say the government must make a plan: "Requires a national plan for X," not "Creates."
   Use only the information given. Do not guess details the text does not state. Do not mention the sponsor or party. If it does several unrelated things, name the main one or use "Changes rules on X and Y."
7. If the text is too vague to tell what it does (budget bills, "miscellaneous amendments," slogan-only titles), write a plain but accurate title such as "Carries out the Ontario budget" or "Makes small technical changes to several laws," and set confidence to "low." Otherwise set confidence to "high."
8. No ending period, no quotation marks, sentence case: capitalize only the first word and proper nouns.

EXAMPLES (invented)
Level: provincial
Official title: An Act to amend the Highway Traffic Act respecting speed limits near schools
Output: {"plain_title": "Lowers speed limits near schools", "confidence": "high"}

Level: provincial
Official title: Building a Stronger Province Act, 2026
Output: {"plain_title": "Changes several provincial laws", "confidence": "low"}

Level: municipal
Committee: Planning and Housing Committee
Motion text: Approve rezoning of 123 Example St for a 12-storey apartment building
Output: {"plain_title": "Allows a 12-storey apartment building at 123 Example St", "confidence": "high"}

Level: municipal
Type: public consultation
Title: Example Park Renewal
Description: The City is planning new playground equipment and a splash pad at Example Park and wants to hear which features matter most.
Output: {"plain_title": "Asks for feedback on new playground and splash pad at Example Park", "confidence": "high"}`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    plain_title: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["high", "low"] },
  },
  required: ["plain_title", "confidence"],
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

const SOURCES = [
  {
    table: "federal_bills",
    pk: "bill_id",
    select: "bill_id,number_code,title,topic_tags,is_government_bill,plain_title,plain_title_source",
    source: (row) => row.title,
    describe: (row) =>
      `Level: federal\nNumber: Bill ${row.number_code}\nOfficial title: ${row.title}\nTopics: ${list(meaningful(row.topic_tags))}\nGovernment bill: ${row.is_government_bill}`,
  },
  {
    table: "provincial_bills",
    pk: "bill_id",
    select: "bill_id,bill_number,title,topic_tags,is_government_bill,plain_title,plain_title_source",
    source: (row) => row.title,
    describe: (row) =>
      `Level: provincial\nNumber: Bill ${row.bill_number}\nOfficial title: ${row.title}\nTopics: ${list(meaningful(row.topic_tags))}\nGovernment bill: ${row.is_government_bill}`,
  },
  {
    table: "motions",
    pk: "motion_id",
    select: "motion_id,motion_number,summary,tags,plain_title,plain_title_source,meetings(committee_name)",
    source: (row) => row.summary,
    describe: (row) =>
      `Level: municipal\nNumber: Motion ${row.motion_number}\nCommittee: ${row.meetings?.committee_name ?? "unknown"}\nMotion text: ${row.summary}\nTopics: ${list(meaningful(row.tags))}`,
  },
  {
    table: "consultations",
    pk: "consultation_id",
    select: "consultation_id,title,description,plain_title,plain_title_source",
    source: (row) => `${row.title}\n${row.description ?? ""}`,
    describe: (row) =>
      `Level: municipal\nType: public consultation\nTitle: ${row.title}\nDescription: ${(row.description ?? "").slice(0, 1500)}`,
  },
  {
    table: "dev_apps",
    pk: "app_id",
    select: "app_id,file_number,address,application_type,plain_title,plain_title_source",
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

function problems({ plain_title: title, confidence }) {
  const found = [];
  const words = title.trim().split(/\s+/).length;
  if (words < 5 || words > 12) found.push(`${words} words`);
  if (title.length > 85) found.push(`${title.length} characters`);
  if (/[.\s]$/.test(title)) found.push("ends with a period or space");
  if (/["“”]/.test(title)) found.push("contains quotation marks");
  if (confidence !== "high" && confidence !== "low") found.push("invalid confidence");
  return found;
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function generate(description) {
  let lastProblems = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: description,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
      const result = JSON.parse(response.text);
      lastProblems = problems(result);
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

for (const { table, pk, select, source, describe, local } of SOURCES) {
  const rows = await supabase(`${table}?select=${select}&order=${pk}`);
  const pending = rows.filter((row) => !row.plain_title || row.plain_title_source !== source(row));
  console.log(`${table}: ${pending.length} of ${rows.length} need a title`);

  for (const row of pending) {
    if (done + failed >= LIMIT) break;
    if (streak >= MAX_FAILURE_STREAK) break;
    const label = `${table} ${row[pk]}`;
    try {
      const { plain_title, confidence } = local ? local(row) : await generate(describe(row));
      console.log(`${label} [${confidence}] ${plain_title}`);
      if (!DRY_RUN) {
        await supabase(`${table}?${pk}=eq.${row[pk]}`, {
          method: "PATCH",
          body: JSON.stringify({
            plain_title,
            plain_title_confidence: confidence,
            plain_title_source: source(row),
          }),
        });
      }
      done++;
      streak = 0;
    } catch (error) {
      failed++;
      streak++;
      console.error(`${label} skipped: ${error.message}`);
    }
    await sleep(DELAY_MS);
  }
}

if (streak >= MAX_FAILURE_STREAK) console.error(`Stopped after ${streak} failures in a row`);
console.log(`${DRY_RUN ? "Dry run: " : ""}${done} titled, ${failed} skipped`);
