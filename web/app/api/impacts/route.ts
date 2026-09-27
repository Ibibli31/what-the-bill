import { analyzeImpacts } from "@/lib/impacts";
import { describeAnswers, sanitizeAnswers } from "@/lib/profile";
import { select } from "@/lib/supabase";
import { getBills } from "@/services/bills";

type Source = { source_text: string | null; source_text_truncated: boolean | null };

/** Table and primary key for each id prefix. */
const TABLES: Record<string, [table: string, pk: string]> = {
  f: ["federal_bills", "bill_id"],
  p: ["provincial_bills", "bill_id"],
  m: ["motions", "motion_id"],
  d: ["dev_apps", "app_id"],
  c: ["consultations", "consultation_id"],
};

const GENERATIONS_PER_MINUTE = 10;
const recent = new Map<string, number[]>();

/** True while `key` is under its per-minute limit; records the attempt. */
function underLimit(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((time) => now - time < 60_000);
  if (hits.length >= GENERATIONS_PER_MINUTE) return false;
  recent.set(key, [...hits, now]);
  return true;
}

/**
 * POST /api/impacts {id, profile} → {impacts: [{category, explanation}]}
 * The item is looked up here by id, so only real bills and the known profile answers reach Gemini.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; profile?: unknown } | null;
  const id = typeof body?.id === "string" && /^[fpmdc]-\d+$/.test(body.id) ? body.id : null;
  if (!id) return Response.json({ error: "id must look like m-123" }, { status: 400 });

  const profile = describeAnswers(sanitizeAnswers(body?.profile));
  // Every answer was "Prefer not to say": nothing to compare the item against.
  if (Object.keys(profile).length === 0) return Response.json({ impacts: [] });

  try {
    const bill = (await getBills()).find((item) => item.id === id);
    if (!bill) return Response.json({ error: "No such item" }, { status: 404 });

    const [table, pk] = TABLES[id[0]];
    const [source] = await select<Source>(table, `select=source_text,source_text_truncated&${pk}=eq.${id.slice(2)}`);
    // No official text: nothing to tie a connection to.
    if (!source?.source_text) return Response.json({ impacts: [] });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!underLimit(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });

    const impacts = await analyzeImpacts(bill, source.source_text, source.source_text_truncated ?? false, profile);
    return Response.json({ impacts });
  } catch (error) {
    console.error("impact analysis failed:", error);
    return Response.json({ error: "Could not analyze this item" }, { status: 502 });
  }
}
