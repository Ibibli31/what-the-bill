// Uploads member portraits to the public `member-photos` Supabase bucket and sets photo_url on matching rows.
// Usage: node --env-file=../.env scripts/upload-member-photos.mjs [photo-folder] [--dry-run]
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const BUCKET = "member-photos";
const SIZE = 256;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const folder = args.find((arg) => !arg.startsWith("--")) ?? join(homedir(), "Downloads", "pictures of mps");

const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

/** Files whose name isn't derivable from the councillor filename pattern, or that belong to an MP/MPP. */
const FILES = {
  "2025-06-18-Ward-20-Councillor-Isabelle-Skalski-web.jpg": ["councillors", "Isabelle Skalski"],
  "tim_tierney_24_en.jpeg": ["councillors", "Tim Tierney"],
  "2022-11-01-Matt-Luloff-Selection-Confirmed.jpg": ["councillors", "Matthew Luloff"],
  "CarneyMark_Lib.jpg": ["mps", "Mark Carney"],
  "FortierMona_Lib.jpg": ["mps", "Mona Fortier"],
  "McGuintyDavidJ_Lib.jpg": ["mps", "David McGuinty"],
  "NaqviYasir_Lib.jpg": ["mps", "Yasir Naqvi"],
  "FanjoyBruce_Lib.jpg": ["mps", "Bruce Fanjoy"],
  "LalondeMarie-France_Lib.jpg": ["mps", "Marie-France Lalonde"],
  "MingarelliGiovanna_Lib.jpg": ["mps", "Giovanna Mingarelli"],
  "SuddsJenna_Lib.jpg": ["mps", "Jenna Sudds"],
  "Stephen_Blais.jpg": ["mpps", "Stephen Blais"],
  "mark_sutcliffe.jpeg": ["councillors", "Mark Sutcliffe"],
  "VandenbeldAnita_Lib.jpg": ["mps", "Anita Vandenbeld"],
  "Catherine-McKenney.jpg": ["mpps", "Catherine McKenney"],
  "Chandra_Pasma.png": ["mpps", "Chandra Pasma"],
  "Darouze_George.jpg": ["mpps", "George Darouze"],
  "Karen_McCrimmon2.jpeg": ["mpps", "Karen McCrimmon"],
  "Lucille-Collard.jpeg": ["mpps", "Lucille Collard"],
  "Stephane_Sarrazin.jpg": ["mpps", "Stéphane Sarrazin"],
  "Tyler_Watt.jpg": ["mpps", "Tyler Watt"],
  "john_fraser.jpg": ["mpps", "John Fraser"],
};

const COUNCILLOR_FILE = /^\d{4}-\d{2}-\d{2}-(.+?)-Selection/;

const normalize = (name) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rest(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${response.status} ${await response.text()}`);
  return response;
}

async function ensureBucket() {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!response.ok && response.status !== 409 && !(await response.clone().text()).includes("already exists")) {
    throw new Error(`Bucket creation failed: ${response.status} ${await response.text()}`);
  }
}

const rowsByTable = {};
async function rowsFor(table) {
  rowsByTable[table] ??= await (await rest(`/rest/v1/${table}?select=name`)).json();
  return rowsByTable[table];
}

const slug = (name) => normalize(name).replace(/ /g, "-");

const files = (await readdir(folder)).filter((file) => /\.(jpe?g|png|webp)$/i.test(file)).sort();
const matched = [];
const unmatched = [];

for (const file of files) {
  let target = FILES[file];
  if (!target) {
    const match = file.match(COUNCILLOR_FILE);
    if (match) target = ["councillors", match[1].replace(/-/g, " ").replace(/\s+Selection.*$/, "")];
  }
  if (!target) {
    unmatched.push(`${file} (no name mapping)`);
    continue;
  }
  const [table, name] = target;
  const row = (await rowsFor(table)).find((candidate) => normalize(candidate.name) === normalize(name));
  if (!row) {
    unmatched.push(`${file} (no ${table} row named "${name}")`);
    continue;
  }
  matched.push({ file, table, name: row.name });
}

if (!dryRun) await ensureBucket();

for (const { file, table, name } of matched) {
  const objectPath = `${table}/${slug(name)}.jpg`;
  if (!dryRun) {
    const image = await sharp(await readFile(join(folder, file)))
      .resize(SIZE, SIZE, { fit: "cover", position: "top" })
      .jpeg({ quality: 85 })
      .toBuffer();
    await rest(`/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: image,
    });
    const photoUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    await rest(`/rest/v1/${table}?name=eq.${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_url: photoUrl }),
    });
  }
  console.log(`${dryRun ? "would upload" : "uploaded"}  ${table.padEnd(12)} ${name}  ←  ${file}`);
}

const counts = Object.fromEntries(["mps", "mpps", "councillors"].map((t) => [t, matched.filter((m) => m.table === t).length]));
console.log(`\nMatched ${matched.length}/${files.length}:`, counts);
if (unmatched.length) console.log("Unmatched:\n  " + unmatched.join("\n  "));
