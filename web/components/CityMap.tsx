import styles from "@/modules/CityMap.module.css";

/**
 * A stylised decorative map of central Ottawa. (Not real)
 */

const W = 800;
const H = 494;
const CX = W / 2;
const CY = H / 2;


function seeded(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Grid = {
  seed: number;
  angle: number; // rotation in degrees
  spacingX: number;
  spacingY: number;
  clip: string; // polygon points
};

// Neighbourhood street grids, each at its own angle, like a real city.
const GRIDS: Grid[] = [
  // North shore (Gatineau side)
  { seed: 11, angle: -14, spacingX: 17, spacingY: 13, clip: "0,0 800,0 800,70 560,105 420,128 300,160 0,180" },
  // West end, left of the canal
  { seed: 23, angle: 9, spacingX: 14, spacingY: 18, clip: "0,196 300,176 360,190 318,494 0,494" },
  // Downtown / Centretown, between the canal and the Rideau
  { seed: 37, angle: 0, spacingX: 13, spacingY: 15, clip: "330,188 440,150 520,150 560,494 300,494" },
  // East of the Rideau River
  { seed: 51, angle: 27, spacingX: 16, spacingY: 14, clip: "500,130 800,80 800,494 540,494" },
];

function gridPaths(grid: Grid) {
  const rand = seeded(grid.seed);
  const reach = 700; // lines extend well past the edges, then get clipped
  let minor = "";
  let collector = "";

  const addLines = (spacing: number, vertical: boolean) => {
    let i = 0;
    for (let p = -reach; p <= reach; p += spacing + (rand() - 0.5) * 5) {
      const isCollector = i % 6 === 0;
      let s = -reach;
      // Break each street into blocks, dropping a few for a natural look.
      while (s < reach) {
        const len = 50 + rand() * 170;
        const e = Math.min(s + len, reach);
        if (isCollector || rand() > 0.14) {
          const seg = vertical
            ? `M${(CX + p).toFixed(1)} ${(CY + s).toFixed(1)}V${(CY + e).toFixed(1)}`
            : `M${(CX + s).toFixed(1)} ${(CY + p).toFixed(1)}H${(CX + e).toFixed(1)}`;
          if (isCollector) collector += seg;
          else minor += seg;
        }
        s = e + (rand() > 0.8 ? spacing : 0);
      }
      i++;
    }
  };

  addLines(grid.spacingX, true);
  addLines(grid.spacingY, false);
  return { minor, collector };
}

const GRID_PATHS = GRIDS.map(gridPaths);

// Water
const OTTAWA_RIVER =
  "M-20 168 C80 160 170 186 262 170 C340 156 392 120 470 108 C560 94 640 70 820 38 L820 88 C660 116 580 136 490 150 C410 162 356 196 270 208 C170 222 90 200 -20 212 Z";
const RIVER_CENTRE = "M-20 190 C80 182 170 206 266 190 C348 176 400 140 480 129 C570 115 650 92 820 63";
const RIDEAU_RIVER = "M505 146 C520 210 500 260 530 320 C556 372 548 430 574 520";
const RIDEAU_CANAL = "M372 176 C366 230 386 270 360 320 C338 362 344 420 316 520";

// Major roads
const MAJOR_ROADS = [
  "M-20 352 C150 338 300 356 420 344 C560 330 680 352 820 336", // Queensway-style highway
  "M150 -20 C160 90 150 190 176 300 C196 390 186 450 196 520",
  "M620 -20 C610 60 640 140 650 240 C660 340 690 420 700 520",
  "M-20 262 C120 256 250 270 340 248",
  "M430 494 C440 400 424 300 446 222",
];

export default function CityMap() {
  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Stylised street map of central Ottawa"
    >
      <defs>
        {GRIDS.map((g, i) => (
          <clipPath id={`wtb-grid-${i}`} key={i}>
            <polygon points={g.clip} />
          </clipPath>
        ))}
        <radialGradient id="wtb-vignette" cx="50%" cy="45%" r="75%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <pattern id="wtb-park" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="#ffffff" fillOpacity="0.09" />
        </pattern>
      </defs>

      <rect width={W} height={H} fill="#2a2a2a" />

      {/* Parks */}
      <g>
        <ellipse cx="286" cy="420" rx="52" ry="36" fill="#303030" />
        <ellipse cx="286" cy="420" rx="52" ry="36" fill="url(#wtb-park)" />
        <rect x="560" y="200" width="54" height="40" rx="6" fill="#303030" transform="rotate(27 587 220)" />
        <rect x="560" y="200" width="54" height="40" rx="6" fill="url(#wtb-park)" transform="rotate(27 587 220)" />
        <rect x="80" y="40" width="70" height="46" rx="6" fill="#303030" transform="rotate(-14 115 63)" />
        <rect x="80" y="40" width="70" height="46" rx="6" fill="url(#wtb-park)" transform="rotate(-14 115 63)" />
      </g>

      {/* Street grids */}
      {GRID_PATHS.map((p, i) => (
        <g key={i} clipPath={`url(#wtb-grid-${i})`}>
          <g transform={`rotate(${GRIDS[i].angle} ${CX} ${CY})`}>
            <path d={p.minor} stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1" fill="none" />
            <path d={p.collector} stroke="#ffffff" strokeOpacity="0.36" strokeWidth="1.6" fill="none" />
          </g>
        </g>
      ))}

      {/* Major roads, with a dark casing so they read above the grid */}
      <g fill="none" strokeLinecap="round">
        {MAJOR_ROADS.map((d) => (
          <path key={`c-${d}`} d={d} stroke="#1c1c1c" strokeWidth="6" />
        ))}
        {MAJOR_ROADS.map((d) => (
          <path key={d} d={d} stroke="#ffffff" strokeOpacity="0.62" strokeWidth="2.6" />
        ))}
      </g>

      {/* Water */}
      <path d={OTTAWA_RIVER} fill="#4b4b4b" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d={RIDEAU_RIVER} fill="none" stroke="#4b4b4b" strokeWidth="13" strokeLinecap="round" />
      <path d={RIDEAU_CANAL} fill="none" stroke="#4b4b4b" strokeWidth="7" strokeLinecap="round" />
      <path id="wtb-river-label" d={RIVER_CENTRE} fill="none" />
      <text className={styles.label} dy="4">
        <textPath href="#wtb-river-label" startOffset="12%">
          OTTAWA RIVER
        </textPath>
      </text>

      {/* Parliament marker */}
      <g transform="translate(398 210) scale(1.15)">
        <circle className={styles.pulse} r="18" fill="#ffffff" fillOpacity="0.18" />
        <circle r="17" fill="#f4f4f4" />
        <g stroke="#1f1f1f" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 -10v-3M0 -13h3.5l-1 1 1 1H0" />
          <path d="M-2.5 -4 0 -10l2.5 6" />
          <path d="M-2.5 -4h5v11h-5z" />
          <path d="M-2.5 7h-5v-6l2.5-2.5 2.5 2.5M2.5 7h5v-6l-2.5-2.5-2.5 2.5" />
          <path d="M-9 7h18" />
        </g>
      </g>

      <rect width={W} height={H} fill="url(#wtb-vignette)" pointerEvents="none" />
    </svg>
  );
}
