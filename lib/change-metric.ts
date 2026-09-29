/**
 * Pixel-level change measurement from aligned before/after RGB photos.
 * Client-safe (runs on a browser canvas, no GPU needed).
 *
 * Green cover uses Excess Green minus Excess Red (ExGR = ExG − ExR > 0),
 * Meyer & Camargo Neto (2008). Handheld field photos are noisier than the
 * controlled studies, so results are always reported with an error band.
 */

export type MetricKind = "GREEN_COVER" | "WATER_AREA";

export const METHODS: Record<MetricKind, { method: string; errorBand: string }> = {
  GREEN_COVER: {
    method: "RGB ExGR (ExG − ExR > 0, Meyer & Camargo Neto 2008) with a green-over-blue sky guard, on aligned 1024×768 frames",
    errorBand: "±~10%",
  },
  WATER_AREA: {
    method: "RGB blue-dominance heuristic on aligned 1024×768 frames (low confidence; no NIR band)",
    errorBand: "±~20%",
  },
};

export function isTarget(r: number, g: number, b: number, kind: MetricKind): boolean {
  const sum = r + g + b;
  if (sum < 45) return false; // too dark to classify
  const rn = r / sum;
  const gn = g / sum;
  const bn = b / sum;
  if (kind === "GREEN_COVER") {
    const exg = 2 * gn - rn - bn;
    const exr = 1.4 * rn - gn;
    // ExGR alone scores saturated blue sky as vegetation; foliage has green > blue.
    return exg - exr > 0 && g > b;
  }
  // Open water in RGB: blue-dominant, not bright white (sky glare, concrete).
  return bn > 0.36 && bn > rn + 0.04 && bn >= gn - 0.02 && sum < 600;
}

export interface ChangeResult {
  beforePct: number;
  afterPct: number;
  deltaPp: number;
  validPixels: number;
  /** RGBA mask in the AFTER frame: gained = green, lost = red, else transparent. */
  mask: ImageData;
}

/**
 * Compare two same-sized RGBA frames. Pixels where the (aligned) before frame
 * has no data (alpha 0, e.g. shifted off-canvas) are excluded from both sides.
 */
export function measureChange(before: ImageData, after: ImageData, kind: MetricKind): ChangeResult {
  const { width, height } = after;
  const mask = new ImageData(width, height);
  const b = before.data;
  const a = after.data;
  const m = mask.data;
  let valid = 0;
  let beforeHits = 0;
  let afterHits = 0;

  for (let i = 0; i < a.length; i += 4) {
    if (b[i + 3] < 200 || a[i + 3] < 200) continue;
    valid++;
    const inBefore = isTarget(b[i], b[i + 1], b[i + 2], kind);
    const inAfter = isTarget(a[i], a[i + 1], a[i + 2], kind);
    if (inBefore) beforeHits++;
    if (inAfter) afterHits++;
    if (inAfter && !inBefore) {
      m[i] = kind === "GREEN_COVER" ? 16 : 40;
      m[i + 1] = kind === "GREEN_COVER" ? 255 : 170;
      m[i + 2] = kind === "GREEN_COVER" ? 140 : 255;
      m[i + 3] = 220;
    } else if (inBefore && !inAfter) {
      m[i] = 255;
      m[i + 1] = 64;
      m[i + 2] = 64;
      m[i + 3] = 200;
    }
  }

  const pct = (n: number) => (valid === 0 ? 0 : Math.round((n / valid) * 1000) / 10);
  const beforePct = pct(beforeHits);
  const afterPct = pct(afterHits);
  return {
    beforePct,
    afterPct,
    deltaPp: Math.round((afterPct - beforePct) * 10) / 10,
    validPixels: valid,
    mask,
  };
}

/** The shared framing for comparison and measurement: identical crop for both photos. */
export const COMPARE_FRAME = "c_fill,g_center,w_1024,h_768";
