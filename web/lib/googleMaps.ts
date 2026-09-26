export type LatLng = { lat: number; lng: number };

export type MapInstance = {
  setCenter(latLng: LatLng): void;
  setZoom(zoom: number): void;
  panTo(latLng: LatLng): void;
  setOptions(options: Record<string, unknown>): void;
};

export type MarkerInstance = {
  setPosition(latLng: LatLng): void;
  setTitle(title: string): void;
  setMap(map: MapInstance | null): void;
};

export type PolygonInstance = {
  setPaths(paths: LatLng[][]): void;
  setMap(map: MapInstance | null): void;
};

export type MapsApi = {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => MapInstance;
  Marker: new (options: Record<string, unknown>) => MarkerInstance;
  Polygon: new (options: Record<string, unknown>) => PolygonInstance;
};

declare global {
  interface Window {
    google?: { maps?: MapsApi };
    gm_authFailure?: () => void;
    __wtbMapsReady?: () => void;
  }
}

export const OTTAWA: LatLng = { lat: 45.4215, lng: -75.6972 };

let mapsPromise: Promise<MapsApi> | null = null;

export function loadMaps(apiKey: string): Promise<MapsApi> {
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
