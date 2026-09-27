import { generate, sourceHash, SUMMARY_VERSION, type ItemInput, type SponsorKind } from "@/lib/summarize";
import { patch, selectFresh } from "@/lib/supabase";

type Saved = {
  plain_summary: string | null;
  plain_summary_confidence: "high" | "low" | null;
  plain_summary_source: string | null;
  source_text: string | null;
  source_text_truncated: boolean | null;
};
type Ward = { ward_number: number } | null;

type Spec<Row> = {
  table: string;
  pk: string;
  select: string;
  input: (row: Row) => Omit<ItemInput, "document" | "truncated">;
};

const SAVED = "plain_summary,plain_summary_confidence,plain_summary_source,source_text,source_text_truncated";
const CLAIM_SECONDS = 60;
const GENERATIONS_PER_MINUTE = 20;

const wardLabel = (ward: Ward, citywide = false) => (citywide || !ward ? "City-wide" : `Ward ${ward.ward_number}`);

function sponsorKind(government: boolean, ottawaSponsor: boolean): SponsorKind {
  if (government) return "government";
  return ottawaSponsor ? "ottawa_member" : "other_member";
}

type FederalRow = Saved & {
  number_code: string;
  title: string;
  status_name: string;
  is_government_bill: boolean;
  sponsor_mp_id: number | null;
};
type ProvincialRow = Saved & {
  bill_number: string;
  title: string;
  current_stage: string;
  is_government_bill: boolean;
  sponsor_mpp_id: number | null;
};
type MotionRow = Saved & {
  motion_number: string;
  result: string | null;
  wards: Ward;
  meetings: { committee_name: string };
};
type DevAppRow = Saved & {
  file_number: string;
  address: string | null;
  application_type: string;
  status: string;
  wards: Ward;
};
type ConsultationRow = Saved & {
  title: string;
  closing_date: string | null;
  is_citywide: boolean;
  wards: Ward;
};

const SPECS = {
  f: {
    table: "federal_bills",
    pk: "bill_id",
    select: `number_code,title,status_name,is_government_bill,sponsor_mp_id,${SAVED}`,
    input: (row: FederalRow) => ({
      itemType: "federal_bill" as const,
      number: row.number_code,
      title: row.title,
      location: "",
      committee: "",
      sponsor: sponsorKind(row.is_government_bill, row.sponsor_mp_id !== null),
      status: row.status_name,
    }),
  } satisfies Spec<FederalRow>,
  p: {
    table: "provincial_bills",
    pk: "bill_id",
    select: `bill_number,title,current_stage,is_government_bill,sponsor_mpp_id,${SAVED}`,
    input: (row: ProvincialRow) => ({
      itemType: "provincial_bill" as const,
      number: row.bill_number,
      title: row.title,
      location: "",
      committee: "",
      sponsor: sponsorKind(row.is_government_bill, row.sponsor_mpp_id !== null),
      status: row.current_stage,
    }),
  } satisfies Spec<ProvincialRow>,
  m: {
    table: "motions",
    pk: "motion_id",
    select: `motion_number,result,wards(ward_number),meetings(committee_name),${SAVED}`,
    input: (row: MotionRow) => ({
      itemType: "motion" as const,
      number: row.motion_number,
      title: row.meetings.committee_name,
      location: wardLabel(row.wards),
      committee: row.meetings.committee_name,
      sponsor: "unknown" as const,
      status: row.result ?? "on the agenda",
    }),
  } satisfies Spec<MotionRow>,
  d: {
    table: "dev_apps",
    pk: "app_id",
    select: `file_number,address,application_type,status,wards(ward_number),${SAVED}`,
    input: (row: DevAppRow) => ({
      itemType: "dev_app" as const,
      number: row.file_number,
      title: row.application_type,
      location: [row.address, row.wards ? wardLabel(row.wards) : ""].filter(Boolean).join(", "),
      committee: "",
      sponsor: "unknown" as const,
      status: row.status,
    }),
  } satisfies Spec<DevAppRow>,
  c: {
    table: "consultations",
    pk: "consultation_id",
    select: `title,closing_date,is_citywide,wards(ward_number),${SAVED}`,
    input: (row: ConsultationRow) => ({
      itemType: "consultation" as const,
      number: "",
      title: row.title,
      location: wardLabel(row.wards, row.is_citywide),
      committee: "",
      sponsor: "unknown" as const,
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
 * POST /api/summary {id} → the saved plain-language summary for that item, or {unavailable: "no_document" | "too_thin"}.
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

    if (!row.source_text) return Response.json({ unavailable: "no_document" });
    const input: ItemInput = { ...spec.input(row), document: row.source_text, truncated: row.source_text_truncated ?? false };
    const source = sourceHash(input);
    if (row.plain_summary && row.plain_summary_source === source) {
      if (row.plain_summary_confidence !== "high") return Response.json({ unavailable: "too_thin" });
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
        plain_summary_version: SUMMARY_VERSION,
        plain_summary_source: source,
        plain_summary_generated_at: new Date().toISOString(),
      });
      if (result.confidence !== "high") return Response.json({ unavailable: "too_thin" });
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
