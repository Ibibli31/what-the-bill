export type GeocodedLocation = {
  lat: number;
  lon: number;
  displayName: string;
};

/** Thrown when the provider responds but has no match for the address. */
export class AddressNotFoundError extends Error {
  constructor(address: string) {
    super(`No geocoding result for "${address}"`);
    this.name = "AddressNotFoundError";
  }
}

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

// Rough box around the City of Ottawa (west,north,east,south). Without `bounded`,
// Nominatim uses it to prefer local matches rather than to exclude others.
const OTTAWA_VIEWBOX = "-76.36,45.54,-75.24,44.96";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export async function geocodeAddress(address: string): Promise<GeocodedLocation> {
  const query = address.trim();
  if (!query) throw new AddressNotFoundError(address);

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "ca",
    viewbox: OTTAWA_VIEWBOX,
  });
  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim responded with ${response.status}`);
  }

  const results = (await response.json()) as NominatimResult[];
  const first = results[0];
  if (!first) throw new AddressNotFoundError(query);

  const lat = Number.parseFloat(first.lat);
  const lon = Number.parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Nominatim returned invalid coordinates");
  }

  return { lat, lon, displayName: first.display_name };
}
