"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/modules/CityMap.module.css";

type LatLng = { lat: number; lng: number };

type MapsApi = {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    google?: { maps?: MapsApi };
    gm_authFailure?: () => void;
    __wtbMapsReady?: () => void;
  }
}

const OTTAWA: LatLng = { lat: 45.4215, lng: -75.6972 };

const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "on" }, { color: "#303030" }],
  },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#5a5a5a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#6e6e6e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#4b4b4b" }] },
];

let mapsPromise: Promise<MapsApi> | null = null;

function loadMaps(apiKey: string): Promise<MapsApi> {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<MapsApi>((resolve, reject) => {
    window.__wtbMapsReady = () => {
      const maps = window.google?.maps;
      if (maps?.Map) resolve(maps);
      else reject(new Error("Google Maps loaded without a Map constructor."));
    };

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(apiKey) +
      "&loading=async&callback=__wtbMapsReady&v=weekly";
    script.async = true;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps failed to load."));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export default function CityMap({ apiKey }: { apiKey?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
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
        new maps.Map(containerRef.current, {
          center: OTTAWA,
          zoom: 13,
          styles: MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          backgroundColor: "#2a2a2a",
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return (
    <div className={styles.map} role="region" aria-label="Map of Ottawa">
      <div ref={containerRef} className={styles.canvas} />
      {error && <p className={styles.message}>{error}</p>}
    </div>
  );
}
