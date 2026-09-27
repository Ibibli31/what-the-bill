import * as cheerio from "cheerio";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const DELAY_MS = 500;
const MAX_ATTEMPTS = 2;
const MAX_CHARS = 150_000;
const DEVAPPS_API = "https://devapps-restapi.ottawa.ca/devapps";
// public key embedded in devapps.ottawa.ca's own page script
const DEVAPPS_KEY = "4r5T2egSmKm5";
const BLOCKED = /access denied|please enable javascript|page not found/i;

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!value) throw new Error(`${name} must be set`);
}

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const DRY_RUN = args.includes("--dry");
const REFRESH = args.includes("--refresh");
const LIMIT = Number(option("--limit") ?? Infinity);
const ONLY = option("--only");
const OUT = option("--out") ?? "source-preview";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (text) => text.replace(/\s+/g, " ").trim();

async function get(url, as = "text") {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`${url} responded ${response.status}`);
      return await response[as]();
    } catch (error) {
      lastError = error;
      await sleep(DELAY_MS * attempt);
    }
  }
  throw lastError;
}

const BREAK = "";

/** Visible text of an element, one line per block. */
function textOf($, element) {
  const copy = $(element).clone();
  copy.find("script, style, noscript").remove();
  copy.find("br").replaceWith(BREAK);
  copy.find("p, div, li, tr, td, h1, h2, h3, h4, h5, h6, table, ul, ol, blockquote").append(BREAK);
  return copy
    .text()
    .split(BREAK)
    .map((line) => clean(line))
    .filter(Boolean)
    .join("\n");
}

async function federalText(row) {
  const $bill = cheerio.load(await get(row.source_url));
  const link = $bill("a").filter((_, a) => clean($bill(a).text()) === "Text of the bill").attr("href");
  if (!link) return { missing: "no bill text published" };
  const url = new URL(link, row.source_url).href;
  const $ = cheerio.load(await get(url));
  $("#TableofContent").remove();
  return { url, text: textOf($, "#flow-content"), mustContain: `BILL ${row.number_code}` };
}

async function provincialText(row) {
  const $ = cheerio.load(await get(row.source_url));
  const body = $(".bill-body").first();
  body.find("a[type='application/pdf']").remove();
  return { url: row.source_url, text: textOf($, body), mustContain: `Bill ${row.bill_number}` };
}

async function devAppText(row) {
  const app = await get(`${DEVAPPS_API}/${encodeURIComponent(row.file_number)}?authKey=${DEVAPPS_KEY}`, "json");
  if (app.applicationNumber !== row.file_number) throw new Error(`API returned ${app.applicationNumber}`);
  const addresses = (app.devAppAddresses ?? []).map((address) => clean(`${address.addressNumber} ${address.roadName} ${address.roadType}`));
  const text = [
    `Application ${app.applicationNumber}: ${app.applicationType?.en ?? ""}`,
    addresses.length ? `Address: ${addresses.join("; ")}` : "",
    app.applicationBriefDesc?.en ?? "",
  ].filter(Boolean).join("\n");
  return { url: row.source_url, text };
}

const meetingPages = new Map();

/** Motion text on an eScribe meeting page, keyed by motion number ("2026-85-03") or item counter and position ("6.1-1"). */
async function meetingMotions(url) {
  if (meetingPages.has(url)) return meetingPages.get(url);
  const $ = cheerio.load(await get(url));
  const motions = new Map();
  $(".AgendaItem").each((_, item) => {
    const counter = clean($(item).find(".AgendaItemCounter").first().text()).replace(/\.$/, "");
    const title = clean($(item).find(".AgendaItemTitle").first().text());
    const description = textOf($, $(item).find(".AgendaItemDescription").first());
    let unnumbered = 0;
    $(item)
      .find(".AgendaItemMotion")
      .filter((_, motion) => $(motion).closest(".AgendaItem")[0] === item)
      .each((_, motion) => {
        const number = clean($(motion).find(".Number .Value").first().text());
        const key = number || `${counter}-${++unnumbered}`;
        const parts = [".PreMotionText", ".MotionText", ".PostMotionText"].map((part) => textOf($, $(motion).find(part).first()));
        motions.set(key, [`Agenda item ${counter}: ${title}`, description, ...parts].filter(Boolean).join("\n"));
      });
  });
  meetingPages.set(url, motions);
  return motions;
}

async function motionText(row) {
  const url = row.meetings.source_url;
  const text = (await meetingMotions(url)).get(row.motion_number);
  if (!text) throw new Error(`motion ${row.motion_number} not found on the meeting page`);
  return { url, text };
}

async function consultationText(row) {
  const $ = cheerio.load(await get(row.source_url));
  const text = $(".full-description").map((_, block) => textOf($, block)).get().join("\n");
  return { url: row.source_url, text };
}

const SOURCES = [
  { table: "federal_bills", pk: "bill_id", select: "bill_id,number_code,source_url", fetchText: federalText, minChars: 200 },
  { table: "provincial_bills", pk: "bill_id", select: "bill_id,bill_number,source_url", fetchText: provincialText, minChars: 200 },
  { table: "dev_apps", pk: "app_id", select: "app_id,file_number,source_url", fetchText: devAppText, minChars: 60 },
  { table: "motions", pk: "motion_id", select: "motion_id,motion_number,meetings(source_url)", fetchText: motionText, minChars: 30 },
  { table: "consultations", pk: "consultation_id", select: "consultation_id,source_url", fetchText: consultationText, minChars: 200 },
];

/** Reasons the fetched text is not the real document; empty when it passes. */
function problems({ text, mustContain }, minChars) {
  const found = [];
  if (text.length < minChars) found.push(`only ${text.length} characters`);
  if (BLOCKED.test(text.slice(0, 2000))) found.push("looks like an error or blocked page");
  if (mustContain && !text.toLowerCase().includes(mustContain.toLowerCase())) found.push(`missing "${mustContain}"`);
  return found;
}

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

const report = [];

for (const { table, pk, select, fetchText, minChars } of SOURCES) {
  if (ONLY && ONLY !== table) continue;
  const pending = DRY_RUN || REFRESH ? "" : "&source_text=is.null";
  const rows = (await supabase(`${table}?select=${select}&order=${pk}${pending}`)).slice(0, LIMIT);
  const tally = { table, ok: 0, truncated: 0, missing: 0, failed: 0 };
  console.log(`\n${table}: ${rows.length} to fetch`);
  if (DRY_RUN) mkdirSync(join(OUT, table), { recursive: true });

  for (const row of rows) {
    const label = `${table} ${row[pk]}`;
    const cachedBefore = table === "motions" && meetingPages.has(row.meetings?.source_url);
    try {
      const result = await fetchText(row);
      if (result.missing) {
        tally.missing++;
        console.log(`${label} NO TEXT: ${result.missing}`);
        continue;
      }
      const found = problems(result, minChars);
      if (found.length) throw new Error(found.join("; "));

      const truncated = result.text.length > MAX_CHARS;
      const text = result.text.slice(0, MAX_CHARS);
      tally.ok++;
      if (truncated) tally.truncated++;
      console.log(`${label} OK ${result.text.length.toLocaleString()} chars${truncated ? " (truncated)" : ""}`);

      if (DRY_RUN) {
        writeFileSync(join(OUT, table, `${row[pk]}.txt`), `URL: ${result.url}\nTruncated: ${truncated}\n\n${text}\n`);
      } else {
        await supabase(`${table}?${pk}=eq.${row[pk]}`, {
          method: "PATCH",
          body: JSON.stringify({
            source_text: text,
            source_text_url: result.url,
            source_text_truncated: truncated,
            source_text_fetched_at: new Date().toISOString(),
          }),
        });
      }
    } catch (error) {
      tally.failed++;
      console.error(`${label} FAILED: ${error.message}`);
    }
    if (!cachedBefore) await sleep(DELAY_MS);
  }
  report.push(tally);
}

console.log(`\n${DRY_RUN ? `Dry run (text saved to ${OUT}/)` : "Saved to Supabase"}`);
console.table(report);
