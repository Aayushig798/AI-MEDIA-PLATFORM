import { db } from "@/lib/db";

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
  };
}
