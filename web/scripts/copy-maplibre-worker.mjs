import { cpSync, mkdirSync } from "node:fs";

// Copies MapLibre's worker files into public/ so the browser can load them by URL.
const source = new URL("../node_modules/maplibre-gl/dist/", import.meta.url);
const target = new URL("../public/maplibre/", import.meta.url);

mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(new URL(file, source), new URL(file, target));
}
