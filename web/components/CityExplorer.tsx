"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import CityMap from "@/components/CityMap";
import LocationSearch from "@/components/LocationSearch";
import Profile from "@/components/Profile";
import Sidebar, { type Representative } from "@/components/Sidebar";
import type { Level } from "@/lib/bill";
import type { Bill } from "@/lib/bill";
import {
  AddressNotFoundError,
  geocodeAddress,
  type GeocodedLocation,
} from "@/services/geocoding";
import { OutsideOttawaRidingError, lookupRidings, type Riding } from "@/services/riding";
import { OutsideOttawaError, lookupWard, type Ward } from "@/services/ward";
import styles from "@/modules/page.module.css";

export default function CityExplorer({
  bills,
  children,
}: {
  /** Null when the bills couldn't be loaded. */
  bills: Bill[] | null;
  /** Shown between the map and the search box (the card's header). */
  children?: ReactNode;
}) {
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ward, setWard] = useState<Ward | null>(null);
  const [ridings, setRidings] = useState<Riding[]>([]);
  const [level, setLevel] = useState<Level>("municipal");
  const wardRequestRef = useRef<AbortController | null>(null);
  const ridingRequestRef = useRef<AbortController | null>(null);

  async function findRidings(found: GeocodedLocation) {
    ridingRequestRef.current?.abort();
    const controller = new AbortController();
    ridingRequestRef.current = controller;
    setRidings([]);
    try {
      const result = await lookupRidings(found.lat, found.lon, controller.signal);
      if (!controller.signal.aborted) setRidings(result);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!(err instanceof OutsideOttawaRidingError)) console.error("Riding lookup failed:", err);
    }
  }

  async function showLocation(found: GeocodedLocation) {
    wardRequestRef.current?.abort();
    const controller = new AbortController();
    wardRequestRef.current = controller;
    setSearching(true);
    setError(null);
    try {
      const result = await lookupWard(found.lat, found.lon, controller.signal);
      if (controller.signal.aborted) return;
      setLocation(found);
      setWard(result);
      setExpanded(true);
      findRidings(found);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof OutsideOttawaError) {
        setError("That address is outside the City of Ottawa. Please choose an address within Ottawa.");
      } else {
        console.error("Ward lookup failed:", err);
        setError("We couldn't check that address right now. Please try again.");
      }
    } finally {
      if (wardRequestRef.current === controller) setSearching(false);
    }
  }

  async function handleSearch(address: string) {
    if (!address.trim()) return;
    setSearching(true);
    setError(null);
    try {
      await showLocation(await geocodeAddress(address));
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

  const councillor: Representative | undefined = ward?.councillor
    ? {
        name: ward.councillor.name,
        district: `Ward ${ward.number} – ${ward.name}`,
        // Motion votes are keyed by ward number.
        districtCode: String(ward.number),
        email: ward.councillor.email ?? undefined,
        phone: ward.councillor.phone ?? undefined,
        photoUrl: ward.councillor.photoUrl ?? undefined,
      }
    : undefined;

  function memberFor(riding: Riding | undefined): Representative | undefined {
    if (!riding?.member) return undefined;
    return {
      name: riding.member.name,
      district: riding.name,
      districtCode: riding.code,
      party: riding.member.party ?? undefined,
      email: riding.member.email ?? undefined,
      phone: riding.member.phone ?? undefined,
      photoUrl: riding.member.photoUrl ?? undefined,
    };
  }

  const federal = ridings.find((riding) => riding.level === "federal");
  const provincial = ridings.find((riding) => riding.level === "provincial");
  const boundary =
    level === "municipal" ? ward?.boundary : level === "federal" ? federal?.boundary : provincial?.boundary;

  const handleFilters = useCallback((filters: { level: Level }) => setLevel(filters.level), []);

  return (
    <>
      <div className={styles.section}>
        <div className={expanded ? `${styles.map} ${styles.mapExpanded}` : styles.map}>
          <CityMap
            location={location}
            boundary={boundary}
            expanded={expanded}
          />
          {!expanded && <p className={styles.mapTag}>Your city · Ottawa</p>}
          {expanded && location && (
            <div className={styles.mapSearch}>
              <div className={styles.mapSearchField}>
                <LocationSearch
                  id="map-location"
                  compact
                  currentAddress={location.displayName}
                  onSearch={handleSearch}
                  onSelect={showLocation}
                  onClear={() => setError(null)}
                  busy={searching}
                  error={error}
                />
              </div>
              <Profile placement="map" />
            </div>
          )}
        </div>
      </div>

      {children}

      <LocationSearch
        currentAddress={location?.displayName}
        onSearch={handleSearch}
        onSelect={showLocation}
        onClear={() => setError(null)}
        busy={searching}
        error={error}
      />

      {/* Filters only appear once we know where the user is. */}
      {location && (
        <Sidebar
          location={location}
          expanded={expanded}
          onOpen={() => setExpanded(true)}
          ward={ward ? `${ward.number} · ${ward.name}` : undefined}
          wardNumber={ward?.number}
          representatives={{
            municipal: councillor,
            federal: memberFor(federal),
            provincial: memberFor(provincial),
          }}
          onChange={handleFilters}
          bills={bills ?? []}
          billsError={bills === null}
        />
      )}

      {/* One profile button at a time: in the page corner, or beside the map's address bar. */}
      {!expanded && <Profile />}
    </>
  );
}