import { db } from "@/lib/db";
import { haversineMeters } from "@/lib/geo";

const SAME_SPOT_M = 150;
const MIN_GAP_DAYS = 7;

type Candidate = {
  id: string;
  secureUrl: string;
  resourceType: string;
  manualLocation: string | null;
  capturedAt: Date;
  integrity: { status: string; verdict: string | null; reviewDecision: string | null; trustScore: number | null; gpsLat: number | null; gpsLng: number | null } | null;
};

function usableAsEvidence(c: Candidate) {
  const i = c.integrity;
  if (!i || i.status !== "DONE") return true; // unverified is allowed, but shown as such
  if (i.reviewDecision === "REJECTED") return false;
  if (i.reviewDecision === "APPROVED") return true;
  return i.verdict !== "FLAGGED";
}

function normalizeLocation(s: string | null) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sameSpot(a: Candidate, b: Candidate) {
  const ga = a.integrity?.gpsLat != null ? { lat: a.integrity.gpsLat, lng: a.integrity.gpsLng! } : null;
  const gb = b.integrity?.gpsLat != null ? { lat: b.integrity.gpsLat, lng: b.integrity.gpsLng! } : null;
  if (ga && gb) return haversineMeters(ga, gb) <= SAME_SPOT_M;
  const la = normalizeLocation(a.manualLocation);
  return la !== "" && la === normalizeLocation(b.manualLocation);
}

/**
 * Before/after candidates: photos of the same spot (GPS within 150 m, or the
 * same location label) at least a week apart. Flagged/rejected photos never pair.
 */
export async function suggestComparisons(projectId: string) {
  const assets = (await db.mediaAsset.findMany({
    where: { projectId, resourceType: "image", capturedAt: { not: null } },
    select: {
      id: true,
      secureUrl: true,
      resourceType: true,
      manualLocation: true,
      capturedAt: true,
      integrity: { select: { status: true, verdict: true, reviewDecision: true, trustScore: true, gpsLat: true, gpsLng: true } },
    },
    orderBy: { capturedAt: "asc" },
  })) as Candidate[];

  const usable = assets.filter(usableAsEvidence);
  const groups: Candidate[][] = [];
  for (const asset of usable) {
    const group = groups.find((g) => g.some((m) => sameSpot(m, asset)));
    if (group) group.push(asset);
    else groups.push([asset]);
  }

  const saved = await db.comparison.findMany({ where: { projectId }, select: { beforeAssetId: true, afterAssetId: true, id: true } });

  return groups
    .filter((g) => g.length >= 2)
    .map((g) => {
      const before = g[0];
      const after = g[g.length - 1];
      const gapDays = Math.round((after.capturedAt.getTime() - before.capturedAt.getTime()) / 86_400_000);
      const existing = saved.find((s) => s.beforeAssetId === before.id && s.afterAssetId === after.id);
      return { before, after, gapDays, location: before.manualLocation, savedComparisonId: existing?.id ?? null };
    })
    .filter((s) => s.gapDays >= MIN_GAP_DAYS);
}
