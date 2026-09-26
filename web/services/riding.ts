import type { WardBoundary } from "@/services/ward";

export type RidingLevel = "federal" | "provincial";

export type Member = {
  name: string;
  party: string | null;
  email: string | null;
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
export async function fetchOttawaMask(signal?: AbortSignal): Promise<WardBoundary> {
  const response = await fetch("/api/ottawa-mask?v=wards", {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Mask lookup responded with ${response.status}`);
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
