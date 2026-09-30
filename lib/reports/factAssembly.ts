import { db, prisma } from "@/lib/db";
import { verifyFullChain } from "@/lib/ledger";

export interface EnrichedComparisonFact {
  id: string;
  verified: boolean;
  matchConfidence: number | null;
  aiReason: string | null;
  changeSummary: string | null;
  notes: string | null;
  beforeDate: string | null;
  afterDate: string | null;
  location: string | null;
  beforeAssetId: string;
  afterAssetId: string;
}

export interface ProjectFacts {
  projectId: string;
  projectName: string;
  projectDescription: string | null;
  projectLocation: string | null;
  totalAssets: number;
  imageCount: number;
  videoCount: number;
  categoryBreakdown: Record<string, number>;
  dateRange: { from: string; to: string } | null;
  totalComparisons: number;
  verifiedComparisonsCount: number;
  comparisons: EnrichedComparisonFact[];
  locations: string[];
  notes: string[];
  /** Proof-of-Impact Integrity Engine results (null in file-store mode). */
  integrity: IntegrityFacts | null;
  /** Pixel-measured change on confirmed before/after pairs. */
  measuredChanges: MeasuredChangeFact[];
  ledger: { projectEntries: number; chainIntact: boolean } | null;
}

export interface IntegrityFacts {
  verified: number;
  awaitingReview: number;
  flagged: number;
  unverified: number;
  humanApproved: number;
  humanRejected: number;
  averageTrustScore: number | null;
}

export interface MeasuredChangeFact {
  comparisonId: string;
  metric: "GREEN_COVER" | "WATER_AREA";
  beforePct: number;
  afterPct: number;
  deltaPp: number;
  method: string;
  beforeDate: string | null;
  afterDate: string | null;
  location: string | null;
  satellite: { index: string; before: number; after: number; agrees: boolean | null } | null;
}

type Effective = "VERIFIED" | "REVIEW" | "FLAGGED" | "UNVERIFIED";

/** Machine verdict, overridden by a human reviewer's decision. */
export function effectiveVerdict(
  i: { status: string; verdict: string | null; reviewDecision: string | null } | null | undefined
): Effective {
  if (!i || i.status !== "DONE") return "UNVERIFIED";
  if (i.reviewDecision === "APPROVED") return "VERIFIED";
  if (i.reviewDecision === "REJECTED") return "FLAGGED";
  return (i.verdict as Effective) ?? "UNVERIFIED";
}

async function integrityFacts(projectId: string): Promise<IntegrityFacts | null> {
  try {
    const rows = await prisma.assetIntegrity.findMany({
      where: { asset: { projectId } },
      select: { status: true, verdict: true, reviewDecision: true, trustScore: true },
    });
    const total = await prisma.mediaAsset.count({ where: { projectId } });
    const counts = { VERIFIED: 0, REVIEW: 0, FLAGGED: 0, UNVERIFIED: total - rows.length };
    for (const r of rows) counts[effectiveVerdict(r)]++;
    const scores = rows.filter((r) => r.status === "DONE" && r.trustScore != null).map((r) => r.trustScore!);
    return {
      verified: counts.VERIFIED,
      awaitingReview: counts.REVIEW,
      flagged: counts.FLAGGED,
      unverified: counts.UNVERIFIED,
      humanApproved: rows.filter((r) => r.reviewDecision === "APPROVED").length,
      humanRejected: rows.filter((r) => r.reviewDecision === "REJECTED").length,
      averageTrustScore: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Assembles purely structured, empirical project facts from the database without any LLM.
 * Strictly guarantees that all metrics, counts, and dates are factual and verifiable.
 */
export async function assembleProjectFacts(projectId: string): Promise<ProjectFacts> {
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  const assets = await db.mediaAsset.findMany({
    where: { projectId },
    include: {
      aiTags: { orderBy: { confidence: "desc" } },
      categories: { include: { category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const comparisons = await db.comparison.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  // Category breakdown calculation
  const categoryBreakdown: Record<string, number> = {};
  for (const a of assets) {
    const catName = (a.manualCategory && a.manualCategory.trim()) || "Uncategorized";
    categoryBreakdown[catName] = (categoryBreakdown[catName] ?? 0) + 1;
  }

  // Date range computed strictly from non-null capturedAt timestamps
  const validDates = assets
    .map((a: any) => (a.capturedAt ? new Date(a.capturedAt) : null))
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

  const dateRange = validDates.length
    ? {
        from: new Date(Math.min(...validDates.map((d) => d.getTime()))).toISOString(),
        to: new Date(Math.max(...validDates.map((d) => d.getTime()))).toISOString(),
      }
    : null;

  // Unique verified physical locations
  const locations = Array.from(
    new Set(
      assets
        .map((a: any) => a.manualLocation?.trim())
        .filter((loc): loc is string => Boolean(loc))
    )
  );

  // Enriched comparisons with concrete before/after metadata
  const enrichedComparisons: EnrichedComparisonFact[] = await Promise.all(
    comparisons.map(async (c: any) => {
      const [before, after] = await Promise.all([
        db.mediaAsset.findUnique({ where: { id: c.beforeAssetId } }),
        db.mediaAsset.findUnique({ where: { id: c.afterAssetId } }),
      ]);

      const bDate = before?.capturedAt
        ? new Date(before.capturedAt).toISOString().split("T")[0]
        : null;
      const aDate = after?.capturedAt
        ? new Date(after.capturedAt).toISOString().split("T")[0]
        : null;

      return {
        id: c.id,
        verified: Boolean(c.verified),
        matchConfidence: c.matchConfidence ?? null,
        aiReason: c.aiReason ?? null,
        changeSummary: c.changeSummary ?? null,
        notes: c.notes ?? null,
        beforeDate: bDate,
        afterDate: aDate,
        location: before?.manualLocation || after?.manualLocation || null,
        beforeAssetId: c.beforeAssetId,
        afterAssetId: c.afterAssetId,
      };
    })
  );

  const notes = assets
    .map((a: any) => a.manualNotes?.trim())
    .filter((n): n is string => Boolean(n));

  // Latest measured change per comparison (change meter)
  let measuredChanges: MeasuredChangeFact[] = [];
  try {
    const metrics = await prisma.changeMetric.findMany({
      where: { comparison: { projectId } },
      orderBy: { createdAt: "desc" },
    });
    const seen = new Set<string>();
    measuredChanges = metrics
      .filter((m) => (seen.has(m.comparisonId) ? false : (seen.add(m.comparisonId), true)))
      .map((m) => {
        const c = enrichedComparisons.find((x) => x.id === m.comparisonId);
        const sat = (m.satDelta ?? null) as { index?: string; before?: number; after?: number; agrees?: boolean } | null;
        return {
          comparisonId: m.comparisonId,
          metric: m.metric,
          beforePct: m.beforePct,
          afterPct: m.afterPct,
          deltaPp: m.deltaPp,
          method: m.method,
          beforeDate: c?.beforeDate ?? null,
          afterDate: c?.afterDate ?? null,
          location: c?.location ?? null,
          satellite:
            sat?.before != null && sat?.after != null
              ? { index: String(sat.index), before: sat.before, after: sat.after, agrees: sat.agrees ?? null }
              : null,
        };
      });
  } catch {
    measuredChanges = [];
  }

  let ledger: ProjectFacts["ledger"] = null;
  try {
    const [projectEntries, chain] = await Promise.all([
      prisma.ledgerEntry.count({ where: { projectId } }),
      verifyFullChain(),
    ]);
    ledger = { projectEntries, chainIntact: chain.ok };
  } catch {
    ledger = null;
  }

  return {
    projectId,
    projectName: project?.name || "Impact Evidence Project",
    projectDescription: project?.description || null,
    projectLocation: project?.location || null,
    totalAssets: assets.length,
    imageCount: assets.filter((a: any) => a.resourceType === "image").length,
    videoCount: assets.filter((a: any) => a.resourceType === "video").length,
    categoryBreakdown,
    dateRange,
    totalComparisons: comparisons.length,
    verifiedComparisonsCount: comparisons.filter((c: any) => c.verified).length,
    comparisons: enrichedComparisons,
    locations,
    notes,
    integrity: await integrityFacts(projectId),
    measuredChanges,
    ledger,
  };
}
