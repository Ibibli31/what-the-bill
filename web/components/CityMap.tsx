"use client";

import { useEffect, useRef, useState } from "react";
import {
  OTTAWA,
  loadMaps,
  type LatLng,
  type MapInstance,
  type MarkerInstance,
  type PolygonInstance,
} from "@/lib/googleMaps";
import type { GeocodedLocation } from "@/services/geocoding";
import type { WardBoundary } from "@/services/ward";
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

const WARD_OUTLINE = {
  strokeColor: "#d52b1e",
  strokeOpacity: 0.9,
  strokeWeight: 2,
  fillColor: "#d52b1e",
  fillOpacity: 0.08,
  clickable: false,
};

/** Converts GeoJSON [lng, lat] rings into Google Maps paths. */
function toPaths(boundary: WardBoundary): LatLng[][] {
  const polygons = boundary.type === "Polygon" ? [boundary.coordinates] : boundary.coordinates;
  return polygons.flatMap((rings) =>
    rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })))
  );
}

type CityMapProps = {
  apiKey?: string;
  location?: GeocodedLocation | null;
  boundary?: WardBoundary | null;
  expanded?: boolean;
  onClose?: () => void;
};

export default function CityMap({
  apiKey,
  location = null,
  boundary = null,
  expanded = false,
  onClose,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MarkerInstance | null>(null);
  const polygonRef = useRef<PolygonInstance | null>(null);
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
        polygonRef.current = new maps.Polygon({ ...WARD_OUTLINE, map: null });
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
    const map = mapRef.current;
    const polygon = polygonRef.current;
    if (!ready || !map || !polygon) return;
    if (!boundary) {
      polygon.setMap(null);
      return;
    }
    polygon.setPaths(toPaths(boundary));
    polygon.setMap(map);
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
