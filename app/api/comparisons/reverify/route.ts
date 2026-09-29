import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COMPARISON_CONFIG } from "@/lib/comparison/config";
import {
  checkHardRules,
  checkContentSimilarity,
  verifyPairWithVision,
} from "@/lib/comparison/verify";

export async function POST(req: NextRequest) {
  try {
    const comparisons = await db.comparison.findMany();
    console.log(`[Re-verification] Starting verification of ${comparisons.length} existing comparisons...`);

    const results = [];

    for (const comp of comparisons) {
      let [assetA, assetB] = await Promise.all([
        db.mediaAsset.findUnique({
          where: { id: comp.beforeAssetId },
          include: { aiTags: { orderBy: { confidence: "desc" } } },
        }),
        db.mediaAsset.findUnique({
          where: { id: comp.afterAssetId },
          include: { aiTags: { orderBy: { confidence: "desc" } } },
        }),
      ]);

      if (!assetA || !assetB) {
        await db.comparison.update({
          where: { id: comp.id },
          data: {
            verified: false,
            matchConfidence: null,
            aiReason: "One or both assets could not be found in database",
            changeSummary: null,
          },
        });
        results.push({
          id: comp.id,
          verified: false,
          reason: "Assets missing from database",
        });
        continue;
      }

      // Chronological ordering check
      let beforeAsset = assetA;
      let afterAsset = assetB;
      if (assetA.capturedAt && assetB.capturedAt) {
        const timeA = new Date(assetA.capturedAt).getTime();
        const timeB = new Date(assetB.capturedAt).getTime();
        if (timeA > timeB) {
          beforeAsset = assetB;
          afterAsset = assetA;
        }
      }

      // 1. Hard Rules
      const hardCheck = checkHardRules(beforeAsset, afterAsset);
      if (!hardCheck.passed) {
        await db.comparison.update({
          where: { id: comp.id },
          data: {
            beforeAssetId: beforeAsset.id,
            afterAssetId: afterAsset.id,
            verified: false,
            matchConfidence: null,
            aiReason: hardCheck.reason || "Failed hard comparison rules",
            changeSummary: null,
          },
        });
        results.push({
          id: comp.id,
          verified: false,
          reason: hardCheck.reason,
        });
        continue;
      }

      // 2. Content Similarity (Computed for audit context)
      const [embedA, embedB] = await Promise.all([
        db.mediaEmbedding.findFirst({ where: { mediaAssetId: beforeAsset.id } }),
        db.mediaEmbedding.findFirst({ where: { mediaAssetId: afterAsset.id } }),
      ]);

      let vectorA: number[] | null = null;
      let vectorB: number[] | null = null;
      if (embedA?.embedding) {
        try {
          vectorA = typeof embedA.embedding === "string" ? JSON.parse(embedA.embedding) : (embedA.embedding as any);
        } catch (e) {}
      }
      if (embedB?.embedding) {
        try {
          vectorB = typeof embedB.embedding === "string" ? JSON.parse(embedB.embedding) : (embedB.embedding as any);
        } catch (e) {}
      }

      const contentCheck = checkContentSimilarity(
        beforeAsset.aiTags || [],
        afterAsset.aiTags || [],
        vectorA,
        vectorB
      );

      // 3. Vision Verification (evaluates scene viewpoint correlation and upserts PairVerification)
      try {
        const vision = await verifyPairWithVision(beforeAsset, afterAsset);
        const isVerified = Boolean(
          contentCheck.passed &&
          vision.sameScene &&
          vision.confidence >= COMPARISON_CONFIG.MIN_VISION_CONFIDENCE
        );

        await db.comparison.update({
          where: { id: comp.id },
          data: {
            beforeAssetId: beforeAsset.id,
            afterAssetId: afterAsset.id,
            verified: isVerified,
            matchConfidence: vision.confidence,
            aiReason: vision.reason,
            changeSummary: vision.visibleChange,
          },
        });

        results.push({
          id: comp.id,
          verified: isVerified,
          confidence: vision.confidence,
          reason: vision.reason,
          visibleChange: vision.visibleChange,
        });
      } catch (visionErr: any) {
        console.error(`[Re-verification] Vision check failed for comparison ${comp.id}:`, visionErr.message || visionErr);
        await db.comparison.update({
          where: { id: comp.id },
          data: {
            beforeAssetId: beforeAsset.id,
            afterAssetId: afterAsset.id,
            verified: false,
            aiReason: `Vision check error: ${visionErr.message || "Failed"}`,
          },
        });
        results.push({
          id: comp.id,
          verified: false,
          error: visionErr.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Re-verified ${comparisons.length} comparisons`,
      total: comparisons.length,
      verifiedCount: results.filter((r) => r.verified).length,
      unverifiedCount: results.filter((r) => !r.verified).length,
      results,
    });
  } catch (err: any) {
    console.error("[POST /api/comparisons/reverify error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reverify comparisons" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Allow GET to also trigger or preview reverification
  return POST(req);
}
