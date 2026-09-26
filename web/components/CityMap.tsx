"use client";

import { useEffect, useRef, useState } from "react";
import type { CircleMarker, GeoJSON as GeoJSONLayer, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeocodedLocation } from "@/services/geocoding";
import type { WardBoundary } from "@/services/ward";
import styles from "@/modules/CityMap.module.css";

const OTTAWA: [number, number] = [45.4215, -75.6972];

// OpenStreetMap's own tiles: no API key or account. Attribution is required, and
// the tile usage policy (https://operations.osmfoundation.org/policies/tiles/)
// asks for light use only. The dark look is a CSS filter in CityMap.module.css.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const WARD_OUTLINE = {
  color: "#d52b1e",
  opacity: 0.9,
  weight: 2,
  fillColor: "#d52b1e",
  fillOpacity: 0.08,
  interactive: false,
};

const PIN = {
  radius: 8,
  color: "#ffffff",
  weight: 2,
  fillColor: "#d52b1e",
  fillOpacity: 1,
};

type Leaflet = typeof import("leaflet");

type CityMapProps = {
  location?: GeocodedLocation | null;
  boundary?: WardBoundary | null;
  expanded?: boolean;
  onClose?: () => void;
};

export default function CityMap({
  location = null,
  boundary = null,
  expanded = false,
  onClose,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const outlineRef = useRef<GeoJSONLayer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Leaflet touches `window` when imported, so load it in the browser only.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    import("leaflet")
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;
        map = L.map(containerRef.current, {
          center: OTTAWA,
          zoom: 13,
          scrollWheelZoom: false,
          attributionControl: true,
        });
        L.tileLayer(TILES, {
          attribution: ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        setReady(true);
      })
      .catch((err: Error) => {
        console.error("Map failed to load:", err);
        if (!cancelled) setError("Map unavailable right now.");
      });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
      outlineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L) return;

    // Small map: let the page scroll past it. Full screen: all gestures.
    if (expanded) {
      map.scrollWheelZoom.enable();
      map.dragging.enable();
    } else {
      map.scrollWheelZoom.disable();
      if (L.Browser.mobile) map.dragging.disable();
    }

    // Wait a frame so the map has picked up its new size before re-centring.
    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
      if (!location) return;
      const position: [number, number] = [location.lat, location.lon];
      if (markerRef.current) markerRef.current.setLatLng(position);
      else markerRef.current = L.circleMarker(position, PIN).addTo(map);
      markerRef.current.bindTooltip(location.displayName);
      map.setView(position, expanded ? 17 : 15);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, location, expanded]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L) return;
    outlineRef.current?.remove();
    outlineRef.current = boundary ? L.geoJSON(boundary, { style: WARD_OUTLINE }).addTo(map) : null;
    // Keep the pin on top of the outline.
    markerRef.current?.bringToFront();
  }, [ready, boundary]);

  useEffect(() => {
    if (!expanded || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, onClose]);

  return (
    <div className={styles.map} role="region" aria-label="Map of Ottawa">
      <div ref={containerRef} className={styles.canvas} />
      {error && <p className={styles.message}>{error}</p>}
      {expanded && (
        <div className={styles.toolbar}>
          <button type="button" className={styles.back} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M19 12H5M11 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>
          {location && <p className={styles.place}>{location.displayName}</p>}
        </div>
      )}
    </div>
  );
}
