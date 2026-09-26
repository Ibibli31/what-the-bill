import type { WardBoundary, Ward } from "@/services/ward";

type WardLookupRow = {
  ward_number: number;
  ward_name: string;
  councillor_name: string | null;
  councillor_email: string | null;
  councillor_phone: string | null;
  boundary: WardBoundary;
};

/** GET /api/ward?lat=..&lng=.. → the ward containing that point, or 404 outside Ottawa. */
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

  const response = await fetch(`${url}/rest/v1/rpc/ward_lookup`, {
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
    console.error("ward_lookup failed:", response.status, await response.text());
    return Response.json({ error: "Ward lookup failed" }, { status: 502 });
  }

  const [row] = (await response.json()) as WardLookupRow[];
  if (!row) return Response.json({ error: "Not inside an Ottawa ward" }, { status: 404 });

  const ward: Ward = {
    number: row.ward_number,
    name: row.ward_name,
    councillor: row.councillor_name
      ? { name: row.councillor_name, email: row.councillor_email, phone: row.councillor_phone }
      : null,
    boundary: row.boundary,
  };
  return Response.json(ward);
}
