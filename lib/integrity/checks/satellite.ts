import { addDays, bboxAround } from "@/lib/geo";
import { CHECK_LABELS, CheckResult, IntegrityContext, skipped } from "../types";

// Copernicus Data Space Ecosystem, Sentinel Hub Statistical API (10,000 PU/month free).
const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATS_URL = "https://sh.dataspace.copernicus.eu/statistics/v1";

const WINDOW_DAYS = 20; // ± around each date, enough for several 5-day revisits
const HALF_SIDE_M = 100; // ~200 m box around the site
const MIN_CHANGE = 0.03; // index change below this is "no detectable change"
const STRONG_REVERSAL = 0.12; // a drop this large is a real contradiction, not noise

// NDVI (vegetation) and NDWI (open water, McFeeters) with clouds/shadows masked via SCL.
const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndwi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const clear = [3, 8, 9, 10].includes(s.SCL) ? 0 : 1;
  const ok = (s.B08 + s.B04 !== 0 && s.B03 + s.B08 !== 0) ? 1 : 0;
  return {
    ndvi: [(s.B08 - s.B04) / (s.B08 + s.B04)],
    ndwi: [(s.B03 - s.B08) / (s.B03 + s.B08)],
    dataMask: [s.dataMask * clear * ok]
  };
}`;

export function satelliteConfigured(): boolean {
  return !!(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.COPERNICUS_CLIENT_ID!,
      client_secret: process.env.COPERNICUS_CLIENT_SECRET!,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || `Copernicus auth HTTP ${res.status}`);
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 };
  return cachedToken.token;
}

export type SatIndex = "ndvi" | "ndwi";

/** Mean cloud-free index over the box around (lat, lng) within ±WINDOW_DAYS of `date`. */
export async function meanIndexAround(lat: number, lng: number, date: Date, index: SatIndex): Promise<number | null> {
  const token = await getToken();
  const from = addDays(date, -WINDOW_DAYS);
  const to = addDays(date, WINDOW_DAYS);
  const res = await fetch(STATS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: {
          bbox: bboxAround(lat, lng, HALF_SIDE_M),
          properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
        },
        data: [{ type: "sentinel-2-l2a", dataFilter: { mosaickingOrder: "leastCC" } }],
      },
      aggregation: {
        timeRange: { from: from.toISOString(), to: to.toISOString() },
        aggregationInterval: { of: `P${WINDOW_DAYS * 2}D`, lastIntervalBehavior: "EXTEND" },
        evalscript: EVALSCRIPT,
        resx: 0.0001,
        resy: 0.0001,
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Copernicus stats HTTP ${res.status}`);

  const means: number[] = (json.data ?? [])
    .map((d: any) => d?.outputs?.[index]?.bands?.B0?.stats?.mean)
    .filter((m: unknown): m is number => typeof m === "number" && Number.isFinite(m));
  if (means.length === 0) return null;
  return means.reduce((s, m) => s + m, 0) / means.length;
}

export interface SatelliteDelta {
  index: SatIndex;
  before: number | null;
  after: number | null;
  delta: number | null;
  beforeDate: string;
  afterDate: string;
}

export async function satelliteDelta(
  lat: number,
  lng: number,
  beforeDate: Date,
  afterDate: Date,
  index: SatIndex
): Promise<SatelliteDelta> {
  const [before, after] = await Promise.all([
    meanIndexAround(lat, lng, beforeDate, index),
    meanIndexAround(lat, lng, afterDate, index),
  ]);
  const round = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 1000);
  return {
    index,
    before: round(before),
    after: round(after),
    delta: before !== null && after !== null ? round(after - before) : null,
    beforeDate: beforeDate.toISOString().slice(0, 10),
    afterDate: afterDate.toISOString().slice(0, 10),
  };
}

/** Check 6: does Sentinel-2 show the claimed direction of change at this site? */
export async function checkSatellite(ctx: IntegrityContext): Promise<CheckResult> {
  const { project } = ctx.asset;
  if (!satelliteConfigured()) return skipped("satellite", "Satellite check not configured (set COPERNICUS_CLIENT_ID/SECRET).");
  if (project.impactType !== "GREENING" && project.impactType !== "WATER") {
    return skipped("satellite", "10 m satellite pixels can't see this kind of project; only greening and water projects are checked.");
  }
  if (!ctx.site || !ctx.takenAt) return skipped("satellite", "Needs a site location and a capture date.");
  if (!project.startDate) return skipped("satellite", "Project has no start date to use as the 'before' pass.");
  if (ctx.takenAt.getTime() - project.startDate.getTime() < 45 * 86_400_000) {
    return skipped("satellite", "Photo is too close to the project start to expect visible change from orbit.");
  }

  const index: SatIndex = project.impactType === "GREENING" ? "ndvi" : "ndwi";
  const result = await satelliteDelta(ctx.site.lat, ctx.site.lng, project.startDate, ctx.takenAt, index);
  const details = { ...result, site: ctx.site };
  const name = index.toUpperCase();

  if (result.delta === null) {
    return skipped("satellite", `No cloud-free Sentinel-2 pass near one of the dates (${result.beforeDate}, ${result.afterDate}).`, details);
  }
  const text = `Sentinel-2 ${name} at this site: ${result.before} → ${result.after}`;
  // One reading covers the whole site and date, so every photo of a project would get the
  // same penalty. Keep it a gentle consistency signal: only a strong reversal costs real points.
  const base = { id: "satellite" as const, label: CHECK_LABELS.satellite, details };
  if (result.delta > MIN_CHANGE) {
    return { ...base, status: "pass", penalty: 0, confidence: "medium", summary: `${text}, agrees with the claimed change.` };
  }
  if (result.delta < -STRONG_REVERSAL) {
    return { ...base, status: "fail", penalty: 10, confidence: "medium", summary: `${text}, a clear reversal of the claimed change.` };
  }
  if (result.delta < -MIN_CHANGE) {
    return { ...base, status: "warn", penalty: 4, confidence: "low", summary: `${text}: slightly lower, not conclusive at 10 m resolution.` };
  }
  return {
    ...base,
    status: "warn",
    penalty: 2,
    confidence: "low",
    summary: `${text}: no change detectable at 10 m (small plots may be below satellite resolution).`,
  };
}
