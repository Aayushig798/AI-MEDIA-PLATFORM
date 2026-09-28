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
    const body = await req.json();
    const { beforeAssetId, afterAssetId, assetIdA, assetIdB } = body;

    const idA = beforeAssetId || assetIdA;
    const idB = afterAssetId || assetIdB;

    if (!idA || !idB) {
      return NextResponse.json(
        { success: false, error: "Two asset IDs are required for verification" },
        { status: 400 }
      );
    }

    if (idA === idB) {
      return NextResponse.json(
        {
          success: false,
          passed: false,
          reason: "Cannot compare an asset with itself",
        },
        { status: 400 }
      );
    }

    let [assetA, assetB] = await Promise.all([
      db.mediaAsset.findUnique({
        where: { id: idA },
        include: { aiTags: { orderBy: { confidence: "desc" } } },
      }),
      db.mediaAsset.findUnique({
        where: { id: idB },
        include: { aiTags: { orderBy: { confidence: "desc" } } },
      }),
    ]);

    if (!assetA || !assetB) {
      return NextResponse.json(
        { success: false, error: "One or both assets not found in database" },
        { status: 404 }
      );
    }

    // Always order before/after by capturedAt automatically
    let beforeAsset = assetA;
    let afterAsset = assetB;

    if (assetA.capturedAt && assetB.capturedAt) {
      const timeA = new Date(assetA.capturedAt).getTime();
      const timeB = new Date(assetB.capturedAt).getTime();
      if (timeA > timeB) {
        beforeAsset = assetB;
        afterAsset = assetA;
      }
    } else if (assetA.capturedAt && !assetB.capturedAt) {
      beforeAsset = assetA;
      afterAsset = assetB;
    } else if (!assetA.capturedAt && assetB.capturedAt) {
      beforeAsset = assetB;
      afterAsset = assetA;
    } else {
      // Fallback for ordering only (checkHardRules will flag missing dates)
      const tA = new Date(assetA.createdAt).getTime();
      const tB = new Date(assetB.createdAt).getTime();
      if (tA > tB) {
        beforeAsset = assetB;
        afterAsset = assetA;
      }
    }

    // 1. Run Hard Rules
    const hardCheck = checkHardRules(beforeAsset, afterAsset);
    if (!hardCheck.passed) {
      return NextResponse.json({
        success: false,
        passed: false,
        reason: hardCheck.reason || "Failed hard comparison rules",
        orderedBeforeId: beforeAsset.id,
        orderedAfterId: afterAsset.id,
      });
    }

    // 2. Fetch embeddings if present
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

    // 3. Run Content Similarity Gate
    const contentCheck = checkContentSimilarity(
      beforeAsset.aiTags || [],
      afterAsset.aiTags || [],
      vectorA,
      vectorB
    );

    if (!contentCheck.passed) {
      return NextResponse.json({
        success: false,
        passed: false,
        reason: contentCheck.reason || "Content similarity is too low for a valid before/after pair",
        orderedBeforeId: beforeAsset.id,
        orderedAfterId: afterAsset.id,
        tagOverlap: contentCheck.tagOverlap,
        embedSim: contentCheck.embedSim,
      });
    }

    // 4. Run Vision Verification (OpenAI GPT-4o-mini + PairVerification cache)
    const vision = await verifyPairWithVision(beforeAsset, afterAsset);

    if (!vision.sameScene || vision.confidence < COMPARISON_CONFIG.MIN_VISION_CONFIDENCE) {
      const reason = !vision.sameScene
        ? `These photos do not look like the same scene: ${vision.reason}`
        : `Vision match confidence is ${(vision.confidence * 100).toFixed(0)}% (minimum ${(COMPARISON_CONFIG.MIN_VISION_CONFIDENCE * 100).toFixed(0)}% required). ${vision.reason}`;

      return NextResponse.json({
        success: false,
        passed: false,
        reason,
        verification: vision,
        orderedBeforeId: beforeAsset.id,
        orderedAfterId: afterAsset.id,
      });
    }

    return NextResponse.json({
      success: true,
      passed: true,
      verified: true,
      verification: vision,
      orderedBeforeId: beforeAsset.id,
      orderedAfterId: afterAsset.id,
    });
  } catch (err: any) {
    console.error("[POST /api/comparisons/verify Error]:", err.message || err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to verify comparison pair",
      },
      { status: 500 }
    );
  }
}
