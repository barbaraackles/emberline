import raw from "@/data/catalog.json";

export type CauseCode = "l" | "h" | "u";
export type Rating = "extreme" | "very-high" | "high" | "moderate" | "watch";
export type FireCentre =
  | "coastal"
  | "kamloops"
  | "cariboo"
  | "prince-george"
  | "northwest"
  | "southeast"
  | "unknown";

export type FireRecord = {
  id: string;
  y: number;
  m: number;
  lat: number;
  lng: number;
  ha: number;
  cause: CauseCode;
  centre: FireCentre | string;
  name: string;
};

export type Hotspot = {
  lat: number;
  lng: number;
  n: number;
  ha: number;
  human: number;
  lightning: number;
  score: number;
  topYear: number;
};

export type NearbyFire = {
  id: string;
  name: string;
  y: number;
  ha: number;
  km: number;
  cause: string;
};

export type City = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  pop: number;
  region: string;
  centre: FireCentre | string;
  note: string;
  n10: number;
  n25: number;
  n50: number;
  ha10: number;
  ha25: number;
  ha50: number;
  starts10: number;
  starts25: number;
  human10: number;
  lightning10: number;
  recent: number;
  largest: NearbyFire | null;
  nearby: NearbyFire[];
  score: number;
  rating: Rating;
};

export type OfficialYear = {
  year: number;
  fires: number;
  ha: number;
  costM: number | null;
  human: number;
  lightning: number;
};

export type Catalog = {
  meta: {
    title: string;
    source: string;
    sourceUrl: string;
    statsSource: string;
    years: [number, number];
    retrieved: string;
    incidents: number;
    mappedFires: number;
    note: string;
  };
  official: OfficialYear[];
  observed: { year: number; n: number; ha: number; human: number; lightning: number }[];
  fires: FireRecord[];
  hotspots: Hotspot[];
  cities: City[];
};

export const catalog = raw as Catalog;

export const YEAR_MIN = 2015;
export const YEAR_MAX = 2025;

export function causeLabel(code: string): string {
  if (code === "l" || code === "lightning") return "Lightning";
  if (code === "h" || code === "human") return "Human";
  return "Undetermined";
}

export function centreLabel(centre: string): string {
  switch (centre) {
    case "coastal":
      return "Coastal";
    case "kamloops":
      return "Kamloops";
    case "cariboo":
      return "Cariboo";
    case "prince-george":
      return "Prince George";
    case "northwest":
      return "Northwest";
    case "southeast":
      return "Southeast";
    default:
      return "Unknown";
  }
}

export function ratingLabel(rating: Rating): string {
  switch (rating) {
    case "extreme":
      return "Extreme";
    case "very-high":
      return "Very high";
    case "high":
      return "High";
    case "moderate":
      return "Moderate";
    default:
      return "Watch";
  }
}

export function prettyName(name: string): string {
  if (!name) return "Unnamed fire";
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned !== cleaned.toUpperCase()) return cleaned;
  return cleaned
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|The|And)\b/g, (m) => m.toLowerCase());
}

export function formatHa(ha: number): string {
  if (ha >= 1_000_000) return `${(ha / 1_000_000).toFixed(2)} M ha`;
  if (ha >= 10_000) return `${(ha / 1000).toFixed(1)} k ha`;
  if (ha >= 100) return `${Math.round(ha).toLocaleString("en-CA")} ha`;
  if (ha >= 10) return `${ha.toFixed(0)} ha`;
  return `${ha.toFixed(1)} ha`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-CA");
}

export function formatCost(millions: number): string {
  if (millions >= 1000) return `$${(millions / 1000).toFixed(2)} B`;
  return `$${millions.toFixed(1)} M`;
}

export const officialTotals = catalog.official.reduce(
  (acc, y) => {
    acc.fires += y.fires;
    acc.ha += y.ha;
    acc.costM += y.costM ?? 0;
    acc.human += y.human;
    acc.lightning += y.lightning;
    return acc;
  },
  { fires: 0, ha: 0, costM: 0, human: 0, lightning: 0 },
);
