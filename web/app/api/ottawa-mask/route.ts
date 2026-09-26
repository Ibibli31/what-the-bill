import type { WardBoundary } from "@/services/ward";

/** GET /api/ottawa-mask → GeoJSON of the world minus the Ottawa ridings. */
export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const response = await fetch(`${url}/rest/v1/rpc/ottawa_mask`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    console.error("ottawa_mask failed:", response.status, await response.text());
    return Response.json({ error: "Mask lookup failed" }, { status: 502 });
  }

  const mask = (await response.json()) as WardBoundary | null;
  if (!mask) return Response.json({ error: "No ridings loaded" }, { status: 404 });
  return Response.json(mask, { headers: { "Cache-Control": "public, max-age=300" } });
}
