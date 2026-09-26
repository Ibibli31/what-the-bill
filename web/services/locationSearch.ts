import type { GeocodedLocation } from "@/services/geocoding";

/** Same shape as a geocoded location, so a picked suggestion can be used directly. */
export type LocationSuggestion = GeocodedLocation;

// Photon (OpenStreetMap data) is built for search-as-you-type. The public
// Nominatim server forbids autocomplete, so suggestions must not use it.
const PHOTON_URL = "https://photon.komoot.io/api/";

const OTTAWA_CENTRE = { lat: "45.4215", lon: "-75.6972" };

export const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;
// Photon often returns the same place several times, so ask for extra and de-duplicate.
const FETCH_LIMIT = 15;

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
  };
};

function describe({ properties: p }: PhotonFeature): string {
  const streetAddress = [p.housenumber, p.street].filter(Boolean).join(" ");
  const parts = [
    p.name && p.name !== streetAddress ? p.name : undefined,
    streetAddress || undefined,
    p.city ?? p.district ?? p.county,
    p.state,
  ];
  return parts.filter((part, i) => part && parts.indexOf(part) === i).join(", ");
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const params = new URLSearchParams({
    q,
    limit: String(FETCH_LIMIT),
    lang: "en",
    countrycode: "CA",
    lat: OTTAWA_CENTRE.lat,
    lon: OTTAWA_CENTRE.lon,
    zoom: "12",
    location_bias_scale: "0.5",
  });
  const response = await fetch(`${PHOTON_URL}?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Photon responded with ${response.status}`);
  }

  const { features } = (await response.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  const suggestions: LocationSuggestion[] = [];
  for (const feature of features) {
    const [lon, lat] = feature.geometry.coordinates;
    const displayName = describe(feature);
    if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (seen.has(displayName)) continue;
    seen.add(displayName);
    suggestions.push({ lat, lon, displayName });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}
