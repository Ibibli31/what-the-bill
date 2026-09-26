import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The .env file lives at the repo root, one level above this app.
const rootEnv = fileURLToPath(new URL("../.env", import.meta.url));

if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w.]+)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    const [, key, raw] = match;
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hides the Next.js badge in the corner during `next dev`. Build errors still show.
  devIndicators: false,
};

export default nextConfig;
