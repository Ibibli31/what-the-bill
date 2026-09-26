/**
 * Minimal server-only client for Supabase's REST (PostgREST) API.
 * Uses the service role key, so it must never be imported from a client component.
 */

if (typeof window !== "undefined") {
  throw new Error("lib/supabase is server-only: it holds the Supabase service role key.");
}

function credentials() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

async function parse<T>(table: string, response: Response) {
  if (!response.ok) {
    throw new Error(`Supabase ${table} responded with ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T[]>;
}

export async function select<T>(table: string, query: string): Promise<T[]> {
  const { url, headers } = credentials();
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers,
    // Scrapers load new data at most a few times a day.
    next: { revalidate: 3600 },
  });
  return parse<T>(table, response);
}

/** Same as `select`, but never served from the cache. */
export async function selectFresh<T>(table: string, query: string): Promise<T[]> {
  const { url, headers } = credentials();
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers, cache: "no-store" });
  return parse<T>(table, response);
}

/** Updates the rows matching `query` and returns the rows it changed. */
export async function patch<T>(table: string, query: string, body: Record<string, unknown>): Promise<T[]> {
  const { url, headers } = credentials();
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return parse<T>(table, response);
}
