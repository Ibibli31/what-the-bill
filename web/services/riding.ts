import type { WardBoundary } from "@/services/ward";

export type RidingLevel = "federal" | "provincial";

export type Member = {
  name: string;
  party: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
};

export type Riding = {
  level: RidingLevel;
  code: string;
  name: string;
  member: Member | null;
  boundary: WardBoundary;
};

/** Thrown when the point isn't inside Ottawa. */
export class OutsideOttawaRidingError extends Error {
  constructor() {
    super("Location is outside Ottawa's ridings");
    this.name = "OutsideOttawaRidingError";
  }
}

/** Fetches the world-minus-Ottawa shape; its holes are the Ottawa ridings. */
const MASK_ATTEMPTS = 3;

export async function fetchOttawaMask(signal?: AbortSignal): Promise<WardBoundary> {
  // The mask is decoration, so ride out brief server or network hiccups before giving up.
  let response: Response | null = null;
  for (let attempt = 1; attempt <= MASK_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt - 1)));
    try {
      response = await fetch("/api/ottawa-mask?v=wards", {
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (err) {
      if (signal?.aborted || attempt === MASK_ATTEMPTS) throw err;
      continue;
    }
    // Only server errors are worth retrying; 404 means no wards are loaded.
    if (response.status < 500) break;
  }
  if (!response?.ok) throw new Error(`Mask lookup responded with ${response?.status}`);
  return (await response.json()) as WardBoundary;
}

/** Looks up the federal and provincial ridings containing a point. */
export async function lookupRidings(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<Riding[]> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lon) });
  const response = await fetch(`/api/riding?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (response.status === 404) throw new OutsideOttawaRidingError();
  if (!response.ok) throw new Error(`Riding lookup responded with ${response.status}`);
  return (await response.json()) as Riding[];
}
