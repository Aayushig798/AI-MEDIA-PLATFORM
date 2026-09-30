import { db } from "@/lib/db";
import { effectiveVerdict } from "@/lib/reports/factAssembly";
import { getNormalizedComparisonUrl } from "@/lib/cloudinary-url";
import { COMPARISON_CONFIG } from "@/lib/comparison/config";
import {
  checkHardRules,
  checkContentSimilarity,
  verifyPairWithVision,
  HardRulesResult,
} from "@/lib/comparison/verify";

export { getNormalizedComparisonUrl };

export interface ComparisonSuggestion {
  id: string;
  projectId: string;
  locationLabel: string;
  timeSpanLabel: string;
  daysApart: number;
  confidence: number;
  reason: string;
  visibleChange: string;
  verified: boolean;
  before: any;
  after: any;
  alreadySaved: boolean;
  savedComparisonId?: string;
}

export interface SuggestedComparisonsResult {
  suggestions: ComparisonSuggestion[];
  missingDateCount: number;
  missingDateAssets: Array<{
    id: string;
    secureUrl: string;
    manualLocation?: string | null;
    manualNotes?: string | null;
    createdAt: string;
  }>;
  totalCandidatePairs: number;
  totalImagesCount: number;
  noQualifyingReason?: "MISSING_DATES" | "NO_CONTENT_MATCH" | "INSUFFICIENT_IMAGES";
  message?: string;
}

/**
 * Generates verified Before/After evidence pairs for a project.
 * Adheres strictly to:
 * 1. Hard rules (image only, non-null capturedAt, >= 4 hours gap, GPS <= 200m or matched manual location)
 * 2. Content similarity gate (weighted tag overlap >= 0.25, vector similarity >= 0.6 if present)
 * 3. OpenAI GPT-4o-mini vision verification (top 5 candidates, sameScene === true && confidence >= 0.7)
 * Never generates fake or filler pairs.
 */
export async function suggestComparisons(
  projectId: string
): Promise<SuggestedComparisonsResult> {
  const assets = await db.mediaAsset.findMany({
    where: { projectId },
    include: {
      aiTags: { orderBy: { confidence: "desc" } },
      categories: { include: { category: true } },
      integrity: { select: { status: true, verdict: true, reviewDecision: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Flagged or reviewer-rejected photos are not evidence, so they never pair.
  const allImages = (assets || []).filter(
    (a: any) => a.resourceType === "image" && effectiveVerdict(a.integrity) !== "FLAGGED"
  );
  const missingDateAssets = allImages
    .filter((a: any) => !a.capturedAt)
    .map((a: any) => ({
      id: a.id,
      secureUrl: a.secureUrl,
      manualLocation: a.manualLocation,
      manualNotes: a.manualNotes,
      createdAt: a.createdAt,
    }));
  const missingDateCount = missingDateAssets.length;
  const datedImages = allImages.filter((a: any) => Boolean(a.capturedAt));

  if (allImages.length < 2) {
    return {
      suggestions: [],
      missingDateCount,
      missingDateAssets,
      totalCandidatePairs: 0,
      totalImagesCount: allImages.length,
      noQualifyingReason: "INSUFFICIENT_IMAGES",
      message: "Upload at least 2 photos to enable before/after comparison suggestions.",
    };
  }

  if (datedImages.length < 2) {
    return {
      suggestions: [],
      missingDateCount,
      missingDateAssets,
      totalCandidatePairs: 0,
      totalImagesCount: allImages.length,
      noQualifyingReason: "MISSING_DATES",
      message: `${missingDateCount} photo${missingDateCount === 1 ? "" : "s"} are missing a capture date. Add dates to enable comparison suggestions.`,
    };
  }

  // Load embeddings (if available in pgvector) and the saved comparisons in parallel
  const embeddingMap = new Map<string, number[]>();
  const assetIds = datedImages.map((a: any) => a.id);
  const [rawEmbeddings, savedComparisons] = await Promise.all([
    db
      .$queryRawUnsafe<Array<{ mediaAssetId: string; embedding: string }>>(
        `SELECT "mediaAssetId", embedding::text FROM "MediaEmbedding" WHERE "mediaAssetId" = ANY($1::text[])`,
        assetIds
      )
      // If pgvector query fails or is not enabled, embeddings are optional
      .catch(() => [] as Array<{ mediaAssetId: string; embedding: string }>),
    db.comparison.findMany({ where: { projectId } }),
  ]);
  for (const row of rawEmbeddings) {
    if (row.embedding) {
      const numbers = row.embedding
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(Number);
      embeddingMap.set(row.mediaAssetId, numbers);
    }
  }

  // 1 & 2. Evaluate all image pairs against Hard Rules and Content Similarity Gate
  interface CandidatePair {
    beforeAsset: any;
    afterAsset: any;
    daysApart: number;
    tagOverlap: number;
    embedSim?: number;
    rankingScore: number;
  }

  const candidatePairs: CandidatePair[] = [];

  for (let i = 0; i < datedImages.length; i++) {
    for (let j = i + 1; j < datedImages.length; j++) {
      const assetA = datedImages[i];
      const assetB = datedImages[j];

      // Gate 1: Hard Rules
      const hardCheck: HardRulesResult = checkHardRules(assetA, assetB);
      if (!hardCheck.passed || !hardCheck.beforeAsset || !hardCheck.afterAsset) {
        continue;
      }

      const before = hardCheck.beforeAsset;
      const after = hardCheck.afterAsset;
      const daysApart = hardCheck.daysApart || 1;

      // Gate 2: Content Similarity Gate
      const embBefore = embeddingMap.get(before.id) || null;
      const embAfter = embeddingMap.get(after.id) || null;
      const contentCheck = checkContentSimilarity(
        before.aiTags || [],
        after.aiTags || [],
        embBefore,
        embAfter
      );

      if (!contentCheck.passed) {
        continue;
      }

      // Ranking score combines tag overlap and optional embedding similarity
      const rankingScore =
        contentCheck.tagOverlap * 0.7 + (contentCheck.embedSim ? contentCheck.embedSim * 0.3 : 0);

      candidatePairs.push({
        beforeAsset: before,
        afterAsset: after,
        daysApart,
        tagOverlap: contentCheck.tagOverlap,
        embedSim: contentCheck.embedSim,
        rankingScore,
      });
    }
  }

  if (candidatePairs.length === 0) {
    const isMissingDates = missingDateCount > 0;
    return {
      suggestions: [],
      missingDateCount,
      missingDateAssets,
      totalCandidatePairs: 0,
      totalImagesCount: allImages.length,
      noQualifyingReason: isMissingDates ? "MISSING_DATES" : "NO_CONTENT_MATCH",
      message: isMissingDates
        ? `${missingDateCount} photo${missingDateCount === 1 ? "" : "s"} are missing a capture date. Add dates to enable comparison suggestions.`
        : "No valid before/after pairs found. Upload photos of the same location taken at different times.",
    };
  }

  // Sort candidate pairs by ranking score descending and take top K
  candidatePairs.sort((a, b) => b.rankingScore - a.rankingScore);
  const topCandidates = candidatePairs.slice(0, COMPARISON_CONFIG.VISION_VERIFY_TOP_K);

  const verifiedSuggestions: ComparisonSuggestion[] = [];

  // Gate 3: Vision Verification on top candidates, all at once (results are sorted below)
  await Promise.all(topCandidates.map(async (cand) => {
    try {
      const verification = await verifyPairWithVision(cand.beforeAsset, cand.afterAsset);

      // Only suggest pairs where sameScene is true and confidence >= 0.7
      if (
        verification.sameScene &&
        verification.confidence >= COMPARISON_CONFIG.MIN_VISION_CONFIDENCE
      ) {
        const before = cand.beforeAsset;
        const after = cand.afterAsset;

        let timeSpanLabel = `${Math.round(cand.daysApart)} days apart`;
        if (cand.daysApart < 1) {
          const hours = Math.max(1, Math.round(cand.daysApart * 24));
          timeSpanLabel = `${hours} hour${hours > 1 ? "s" : ""} apart (same day)`;
        } else if (cand.daysApart >= 365) {
          const years = (cand.daysApart / 365).toFixed(1);
          timeSpanLabel = `${years} years apart`;
        } else if (cand.daysApart >= 30) {
          const months = Math.round(cand.daysApart / 30);
          timeSpanLabel = `${months} month${months > 1 ? "s" : ""} apart`;
        }

        const locLabel =
          before.manualLocation ||
          after.manualLocation ||
          (before.exifLat ? `${before.exifLat.toFixed(3)}, ${before.exifLng?.toFixed(3)}` : "Verified Site");

        const existing = savedComparisons.find(
          (c: any) =>
            (c.beforeAssetId === before.id && c.afterAssetId === after.id) ||
            (c.beforeAssetId === after.id && c.afterAssetId === before.id)
        );

        verifiedSuggestions.push({
          id: `sug_${before.id}_${after.id}`,
          projectId,
          locationLabel: locLabel,
          timeSpanLabel,
          daysApart: cand.daysApart,
          confidence: verification.confidence,
          reason: verification.reason,
          visibleChange: verification.visibleChange,
          verified: true,
          before: {
            ...before,
            normalizedUrl: getNormalizedComparisonUrl(before.secureUrl),
          },
          after: {
            ...after,
            normalizedUrl: getNormalizedComparisonUrl(after.secureUrl),
          },
          alreadySaved: Boolean(existing),
          savedComparisonId: existing?.id,
        });
      }
    } catch (err: any) {
      console.warn(
        `[Pair Verification Warning] Pair ${cand.beforeAsset.id} <-> ${cand.afterAsset.id}:`,
        err.message || err
      );
    }
  }));

  // Sort suggestions by confidence (descending), then by time gap (descending)
  verifiedSuggestions.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.daysApart - a.daysApart;
  });

  const noQualifyingReason =
    verifiedSuggestions.length === 0
      ? missingDateCount > 0
        ? "MISSING_DATES"
        : "NO_CONTENT_MATCH"
      : undefined;

  const message =
    verifiedSuggestions.length === 0
      ? noQualifyingReason === "MISSING_DATES"
        ? `${missingDateCount} photo${missingDateCount === 1 ? "" : "s"} are missing a capture date. Add dates to enable comparison suggestions.`
        : "No valid before/after pairs found. Upload photos of the same location taken at different times."
      : undefined;

  return {
    suggestions: verifiedSuggestions,
    missingDateCount,
    missingDateAssets,
    totalCandidatePairs: candidatePairs.length,
    totalImagesCount: allImages.length,
    noQualifyingReason,
    message,
  };
}
