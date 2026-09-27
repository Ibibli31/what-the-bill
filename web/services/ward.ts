/** GeoJSON ward outline; rings are lists of [lng, lat] points. */
export type WardBoundary =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

export type Councillor = {
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
};

export type Ward = {
  number: number;
  name: string;
  councillor: Councillor | null;
  boundary: WardBoundary;
};

/** Thrown when the point isn't inside any Ottawa ward. */
export class OutsideOttawaError extends Error {
  constructor() {
    super("Location is outside Ottawa's wards");
    this.name = "OutsideOttawaError";
  }
}

export async function lookupWard(lat: number, lon: number, signal?: AbortSignal): Promise<Ward> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lon) });
  const response = await fetch(`/api/ward?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (response.status === 404) throw new OutsideOttawaError();
  if (!response.ok) throw new Error(`Ward lookup responded with ${response.status}`);
  return (await response.json()) as Ward;
}
