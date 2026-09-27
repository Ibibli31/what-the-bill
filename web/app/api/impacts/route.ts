import { analyzeImpacts } from "@/lib/impacts";
import { describeAnswers, sanitizeAnswers } from "@/lib/profile";
import { getBills } from "@/services/bills";

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

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!underLimit(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });

    return Response.json({ impacts: await analyzeImpacts(bill, profile) });
  } catch (error) {
    console.error("impact analysis failed:", error);
    return Response.json({ error: "Could not analyze this item" }, { status: 502 });
  }
}
