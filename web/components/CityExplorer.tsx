"use client";

import { useCallback, useRef, useState } from "react";
import CityMap from "@/components/CityMap";
import LocationSearch from "@/components/LocationSearch";
import Sidebar, { type Representative } from "@/components/Sidebar";
import type { Bill } from "@/lib/bill";
import {
  AddressNotFoundError,
  geocodeAddress,
  type GeocodedLocation,
} from "@/services/geocoding";
import { OutsideOttawaError, lookupWard, type Ward } from "@/services/ward";
import styles from "@/modules/page.module.css";

type WardStatus = "loading" | "done" | "outside" | "error";

const WARD_STATUS_LABEL: Record<WardStatus, string | undefined> = {
  loading: undefined,
  done: undefined,
  outside: "outside Ottawa",
  error: "unavailable",
};

export default function CityExplorer({
  apiKey,
  bills,
}: {
  apiKey?: string;
  /** Null when the bills couldn't be loaded. */
  bills: Bill[] | null;
}) {
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ward, setWard] = useState<Ward | null>(null);
  const [wardStatus, setWardStatus] = useState<WardStatus>("loading");
  const wardRequestRef = useRef<AbortController | null>(null);

  async function findWard(found: GeocodedLocation) {
    wardRequestRef.current?.abort();
    const controller = new AbortController();
    wardRequestRef.current = controller;
    setWard(null);
    setWardStatus("loading");
    try {
      const result = await lookupWard(found.lat, found.lon, controller.signal);
      if (controller.signal.aborted) return;
      setWard(result);
      setWardStatus("done");
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!(err instanceof OutsideOttawaError)) console.error("Ward lookup failed:", err);
      setWardStatus(err instanceof OutsideOttawaError ? "outside" : "error");
    }
  }

  function showLocation(found: GeocodedLocation) {
    setError(null);
    setLocation(found);
    setExpanded(true);
    findWard(found);
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

  const councillor: Representative | undefined = ward?.councillor
    ? {
        name: ward.councillor.name,
        district: `Ward ${ward.number} – ${ward.name}`,
        email: ward.councillor.email ?? undefined,
        phone: ward.councillor.phone ?? undefined,
      }
    : undefined;

  return (
    <>
      <div className={styles.section}>
        <p className={styles.label}>Your city</p>
        <div className={expanded ? `${styles.map} ${styles.mapExpanded}` : styles.map}>
          <CityMap
            apiKey={apiKey}
            location={location}
            boundary={ward?.boundary}
            expanded={expanded}
            onClose={close}
          />
        </div>
      </div>

      <LocationSearch
        onSearch={handleSearch}
        onSelect={showLocation}
        busy={searching}
        error={error}
      />

      {/* Filters only appear once we know where the user is. */}
      {location && (
        <Sidebar
          location={location}
          expanded={expanded}
          onOpen={() => setExpanded(true)}
          ward={ward ? `${ward.number} · ${ward.name}` : WARD_STATUS_LABEL[wardStatus]}
          representatives={{ municipal: councillor }}
          bills={bills ?? []}
          billsError={bills === null}
        />
      )}
    </>
  );
}