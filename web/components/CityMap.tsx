"use client";

import { useEffect, useRef, useState } from "react";
import type { CircleMarker, GeoJSON as GeoJSONLayer, LatLngBounds, Map as LeafletMap } from "leaflet";
import type { StyleSpecification } from "maplibre-gl";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import basicStyle from "@/lib/mapStyle.json";
import type { GeocodedLocation } from "@/services/geocoding";
import { fetchOttawaMask } from "@/services/riding";
import type { WardBoundary } from "@/services/ward";
import styles from "@/modules/CityMap.module.css";

const OTTAWA: [number, number] = [45.4215, -75.6972];

// OpenMapTiles "Basic" style drawn from OpenFreeMap vector tiles; no API key needed.
const MAP_STYLE = basicStyle as StyleSpecification;
const MAPLIBRE_WORKER = "/maplibre/maplibre-gl-worker.mjs";

const WARD_OUTLINE = {
  color: "#d52b1e",
  opacity: 0.9,
  weight: 2,
  fillColor: "#d52b1e",
  fillOpacity: 0.25,
  interactive: false,
};

const MASK_STYLE = {
  stroke: false,
  fillColor: "#000000",
  fillOpacity: 0.6,
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
};

export default function CityMap({
  location = null,
  boundary = null,
  expanded = false,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const outlineRef = useRef<GeoJSONLayer | null>(null);
  const [ready, setReady] = useState(false);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Leaflet touches `window` when imported, so load it in the browser only.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    Promise.all([
      import("leaflet"),
      import("maplibre-gl"),
      import("@maplibre/maplibre-gl-leaflet"),
    ])
      .then(([L, maplibre, { maplibreGL }]) => {
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;
        maplibre.setWorkerUrl(MAPLIBRE_WORKER);
        map = L.map(containerRef.current, {
          center: OTTAWA,
          zoom: 13,
          scrollWheelZoom: false,
          attributionControl: true,
          maxZoom: 19,
          maxBoundsViscosity: 1,
        });
        maplibreGL({ style: MAP_STYLE }).addTo(map);
        map.createPane("mask").style.zIndex = "350";
        mapRef.current = map;
        setReady(true);

        fetchOttawaMask()
          .then((mask) => {
            if (cancelled || !map) return;
            L.geoJSON(mask, { style: MASK_STYLE, pane: "mask" }).addTo(map);
            const rings = mask.type === "Polygon" ? mask.coordinates : mask.coordinates.flat();
            const holes = rings.slice(1).flat();
            setBounds(L.latLngBounds(holes.map(([lng, lat]) => [lat, lng])).pad(0.02));
          })
          .catch((err: Error) => console.error("Ottawa mask failed:", err.message));
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
      if (bounds) {
        map.setMaxBounds(bounds);
        map.setMinZoom(map.getBoundsZoom(bounds));
      }
      if (!location) return;
      const position: [number, number] = [location.lat, location.lon];
      if (markerRef.current) markerRef.current.setLatLng(position);
      else markerRef.current = L.circleMarker(position, PIN).addTo(map);
      markerRef.current.bindTooltip(location.displayName);
      map.setView(position, expanded ? 17 : 15);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, location, expanded, bounds]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L) return;
    outlineRef.current?.remove();
    outlineRef.current = boundary ? L.geoJSON(boundary, { style: WARD_OUTLINE }).addTo(map) : null;
    // Keep the pin on top of the outline.
    markerRef.current?.bringToFront();
  }, [ready, boundary]);

  return (
    <div className={styles.map} role="region" aria-label="Map of Ottawa">
      <div ref={containerRef} className={styles.canvas} />
      {error && <p className={styles.message}>{error}</p>}
    </div>
  );
}
