"use client";

import { useEffect, useRef, useState } from "react";
import {
  OTTAWA,
  loadMaps,
  type MapInstance,
  type MarkerInstance,
} from "@/lib/googleMaps";
import type { GeocodedLocation } from "@/services/geocoding";
import styles from "@/modules/CityMap.module.css";

const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#111b23" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b9c9d2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111b23" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "on" }, { color: "#16261f" }],
  },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#243441" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#314352" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#6f808c" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1218" }] },
];

type CityMapProps = {
  apiKey?: string;
  location?: GeocodedLocation | null;
  expanded?: boolean;
  onClose?: () => void;
};

export default function CityMap({
  apiKey,
  location = null,
  expanded = false,
  onClose,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MarkerInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    apiKey ? null : "Map unavailable: API_KEY is not set in .env."
  );

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;

    window.gm_authFailure = () => {
      if (!cancelled) setError("Google Maps rejected the API key.");
    };

    loadMaps(apiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: OTTAWA,
          zoom: 13,
          styles: MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          backgroundColor: "#2a2a2a",
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        markerRef.current = new maps.Marker({ map: null });
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!ready || !map || !marker) return;

    map.setOptions({ gestureHandling: expanded ? "greedy" : "cooperative" });

    if (!location) return;
    const position = { lat: location.lat, lng: location.lon };
    marker.setPosition(position);
    marker.setTitle(location.displayName);
    marker.setMap(map);
    // Wait a frame so the map has picked up its new size before re-centring.
    const frame = requestAnimationFrame(() => {
      map.setCenter(position);
      map.setZoom(expanded ? 17 : 15);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, location, expanded]);

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
