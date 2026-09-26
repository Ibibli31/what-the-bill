/**
 * Minimal server-only client for Supabase's REST (PostgREST) API.
 * Uses the service role key, so it must never be imported from a client component.
 */

if (typeof window !== "undefined") {
  throw new Error("lib/supabase is server-only: it holds the Supabase service role key.");
}

export async function select<T>(table: string, query: string): Promise<T[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    // Scrapers load new data at most a few times a day.
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${table} responded with ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T[]>;
}
