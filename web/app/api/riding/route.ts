import type { Riding, RidingLevel } from "@/services/riding";
import type { WardBoundary } from "@/services/ward";

type RidingLookupRow = {
  level: RidingLevel;
  code: string;
  riding_name: string;
  member_name: string | null;
  member_party: string | null;
  member_email: string | null;
  member_phone: string | null;
  boundary: WardBoundary;
};

/** GET /api/riding?lat=..&lng=.. → the federal and provincial ridings at that point, or 404 outside Ottawa. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number.parseFloat(searchParams.get("lat") ?? "");
  const lng = Number.parseFloat(searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat and lng must be numbers" }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const response = await fetch(`${url}/rest/v1/rpc/riding_lookup`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ lat, lng }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("riding_lookup failed:", response.status, await response.text());
    return Response.json({ error: "Riding lookup failed" }, { status: 502 });
  }

  const rows = (await response.json()) as RidingLookupRow[];
  if (rows.length === 0) return Response.json({ error: "Not inside Ottawa" }, { status: 404 });

  const ridings: Riding[] = rows.map((row) => ({
    level: row.level,
    code: row.code,
    name: row.riding_name,
    member: row.member_name
      ? { name: row.member_name, party: row.member_party, email: row.member_email, phone: row.member_phone }
      : null,
    boundary: row.boundary,
  }));
  return Response.json(ridings);
}
