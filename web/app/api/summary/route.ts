import { createHash } from "node:crypto";
import { generate, describe, type ItemInput, type SponsorKind } from "@/lib/summarize";
import { patch, selectFresh } from "@/lib/supabase";

type Saved = { plain_summary: string | null; plain_summary_confidence: "high" | "low" | null; plain_summary_source: string | null };
type Ward = { ward_number: number } | null;

type Spec<Row> = {
  table: string;
  pk: string;
  select: string;
  input: (row: Row) => ItemInput;
};

const SAVED = "plain_summary,plain_summary_confidence,plain_summary_source";
const MAX_DETAILS = 1500;
const CLAIM_SECONDS = 60;
const GENERATIONS_PER_MINUTE = 20;

const clip = (text: string | null) => (text ?? "").trim().slice(0, MAX_DETAILS);
const wardLabel = (ward: Ward, citywide = false) => (citywide || !ward ? "City-wide" : `Ward ${ward.ward_number}`);
const topics = (tags: string[] | null) => (tags?.length ? `Topics: ${tags.join(", ")}` : "");

function sponsorKind(government: boolean, ottawaSponsor: boolean): SponsorKind {
  if (government) return "government";
  return ottawaSponsor ? "ottawa_member" : "other_member";
}

type FederalRow = Saved & {
  title: string;
  status_name: string;
  topic_tags: string[] | null;
  is_government_bill: boolean;
  sponsor_mp_id: number | null;
};
type ProvincialRow = Saved & {
  title: string;
  current_stage: string;
  topic_tags: string[] | null;
  is_government_bill: boolean;
  sponsor_mpp_id: number | null;
};
type MotionRow = Saved & {
  summary: string;
  result: string | null;
  wards: Ward;
  meetings: { committee_name: string };
};
type DevAppRow = Saved & {
  address: string | null;
  application_type: string;
  status: string;
  wards: Ward;
};
type ConsultationRow = Saved & {
  title: string;
  description: string | null;
  closing_date: string | null;
  is_citywide: boolean;
  wards: Ward;
};

const SPECS = {
  f: {
    table: "federal_bills",
    pk: "bill_id",
    select: `title,status_name,topic_tags,is_government_bill,sponsor_mp_id,${SAVED}`,
    input: (row: FederalRow): ItemInput => ({
      itemType: "federal_bill",
      title: row.title,
      details: topics(row.topic_tags),
      location: "",
      committee: "",
      sponsor: sponsorKind(row.is_government_bill, row.sponsor_mp_id !== null),
      status: row.status_name,
    }),
  } satisfies Spec<FederalRow>,
  p: {
    table: "provincial_bills",
    pk: "bill_id",
    select: `title,current_stage,topic_tags,is_government_bill,sponsor_mpp_id,${SAVED}`,
    input: (row: ProvincialRow): ItemInput => ({
      itemType: "provincial_bill",
      title: row.title,
      details: topics(row.topic_tags),
      location: "",
      committee: "",
      sponsor: sponsorKind(row.is_government_bill, row.sponsor_mpp_id !== null),
      status: row.current_stage,
    }),
  } satisfies Spec<ProvincialRow>,
  m: {
    table: "motions",
    pk: "motion_id",
    select: `summary,result,wards(ward_number),meetings(committee_name),${SAVED}`,
    input: (row: MotionRow): ItemInput => ({
      itemType: "motion",
      title: row.meetings.committee_name,
      details: clip(row.summary),
      location: wardLabel(row.wards),
      committee: row.meetings.committee_name,
      sponsor: "unknown",
      status: row.result ?? "on the agenda",
    }),
  } satisfies Spec<MotionRow>,
  d: {
    table: "dev_apps",
    pk: "app_id",
    select: `address,application_type,status,wards(ward_number),${SAVED}`,
    input: (row: DevAppRow): ItemInput => ({
      itemType: "dev_app",
      title: row.application_type,
      details: "",
      location: [row.address, row.wards ? wardLabel(row.wards) : ""].filter(Boolean).join(", "),
      committee: "",
      sponsor: "unknown",
      status: row.status,
    }),
  } satisfies Spec<DevAppRow>,
  c: {
    table: "consultations",
    pk: "consultation_id",
    select: `title,description,closing_date,is_citywide,wards(ward_number),${SAVED}`,
    input: (row: ConsultationRow): ItemInput => ({
      itemType: "consultation",
      title: row.title,
      details: clip(row.description),
      location: wardLabel(row.wards, row.is_citywide),
      committee: "",
      sponsor: "unknown",
      status: row.closing_date ? `open until ${row.closing_date}` : "open",
    }),
  } satisfies Spec<ConsultationRow>,
};

type Prefix = keyof typeof SPECS;

const recent = new Map<string, number[]>();

/** True while `key` is under its per-minute generation limit; records the attempt. */
function underLimit(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((time) => now - time < 60_000);
  if (hits.length >= GENERATIONS_PER_MINUTE) return false;
  recent.set(key, [...hits, now]);
  return true;
}

/**
 * POST /api/summary {id} → the saved plain-language summary for that item.
 * Generates and saves one on the first request; answers 202 while another request is generating it.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const match = typeof body?.id === "string" ? /^([fpmdc])-(\d+)$/.exec(body.id) : null;
  if (!match) return Response.json({ error: "id must look like m-123" }, { status: 400 });
  const prefix = match[1] as Prefix;
  const spec = SPECS[prefix] as unknown as Spec<Saved>;
  const key = `${spec.pk}=eq.${match[2]}`;

  try {
    const [row] = await selectFresh<Saved>(spec.table, `select=${spec.select}&${key}`);
    if (!row) return Response.json({ error: "No such item" }, { status: 404 });

    const input = spec.input(row);
    const source = createHash("sha256").update(describe(input)).digest("hex");
    if (row.plain_summary && row.plain_summary_source === source) {
      return Response.json({ summary: row.plain_summary, confidence: row.plain_summary_confidence });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!underLimit(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });

    const stale = new Date(Date.now() - CLAIM_SECONDS * 1000).toISOString();
    const claimed = await patch(
      spec.table,
      `${key}&or=(plain_summary_generated_at.is.null,plain_summary_generated_at.lt.${encodeURIComponent(stale)})`,
      { plain_summary_generated_at: new Date().toISOString() }
    );
    if (claimed.length === 0) return Response.json({ pending: true }, { status: 202 });

    try {
      const result = await generate(input);
      await patch(spec.table, key, {
        plain_summary: result.summary,
        plain_summary_confidence: result.confidence,
        plain_summary_source: source,
        plain_summary_generated_at: new Date().toISOString(),
      });
      return Response.json(result);
    } catch (error) {
      await patch(spec.table, key, { plain_summary_generated_at: null }).catch(() => []);
      throw error;
    }
  } catch (error) {
    console.error("summary failed:", error);
    return Response.json({ error: "Could not write a summary" }, { status: 502 });
  }
}
