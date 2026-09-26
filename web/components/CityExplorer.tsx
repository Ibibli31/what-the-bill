"use client";

import { useCallback, useState } from "react";
import CityMap from "@/components/CityMap";
import LocationSearch from "@/components/LocationSearch";
import {
  AddressNotFoundError,
  geocodeAddress,
  type GeocodedLocation,
} from "@/services/geocoding";
import styles from "@/modules/page.module.css";

export default function CityExplorer({ apiKey }: { apiKey?: string }) {
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function showLocation(found: GeocodedLocation) {
    setError(null);
    setLocation(found);
    setExpanded(true);
    // TODO: use found.lat / found.lon to look up the riding, MP,
    // councillor and nearby development applications.
  }

  async function handleSearch(address: string) {
    if (!address.trim()) return;
    setSearching(true);
    setError(null);
    try {
      showLocation(await geocodeAddress(address));
    } catch (err) {
      if (err instanceof AddressNotFoundError) {
        setError("We couldn't find that address. Try entering a more complete Ottawa address.");
      } else {
        console.error("Geocoding failed:", err);
        setError("We couldn't look up that address right now. Please try again.");
      }
    } finally {
      setSearching(false);
    }
  }

  const close = useCallback(() => setExpanded(false), []);

  return (
    <>
      <div className={expanded ? `${styles.map} ${styles.mapExpanded}` : styles.map}>
        <CityMap apiKey={apiKey} location={location} expanded={expanded} onClose={close} />
      </div>

      <LocationSearch
        onSearch={handleSearch}
        onSelect={showLocation}
        busy={searching}
        error={error}
      />
    </>
  );
}
