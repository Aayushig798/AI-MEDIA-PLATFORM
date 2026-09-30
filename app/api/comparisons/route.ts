import { NextRequest, NextResponse } from "next/server";
import { db, prisma } from "@/lib/db";
import { effectiveVerdict } from "@/lib/reports/factAssembly";
import { getNormalizedComparisonUrl } from "@/lib/cloudinary-url";
import { COMPARISON_CONFIG } from "@/lib/comparison/config";
import {
  checkHardRules,
  checkContentSimilarity,
  verifyPairWithVision,
} from "@/lib/comparison/verify";
import { logEvent } from "@/lib/audit/logEvent";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;

    const comparisons = await db.comparison.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: "desc" },
    });

    // Hydrate every comparison with its before/after assets and latest PairVerification using
    // two batched queries in total, instead of three queries per comparison
    const assetIds = Array.from(new Set(comparisons.flatMap((c: any) => [c.beforeAssetId, c.afterAssetId])));
    const pairFilters = comparisons.flatMap((c: any) => [
      { beforeAssetId: c.beforeAssetId, afterAssetId: c.afterAssetId },
      { beforeAssetId: c.afterAssetId, afterAssetId: c.beforeAssetId },
    ]);
    const [assets, pairVers] = comparisons.length
      ? await Promise.all([
          db.mediaAsset.findMany({
            where: { id: { in: assetIds } },
            include: {
              aiTags: { orderBy: { confidence: "desc" } },
              categories: { include: { category: true } },
            },
          }),
          prisma.pairVerification.findMany({ where: { OR: pairFilters }, orderBy: { createdAt: "desc" } }),
        ])
      : [[], []];
    const assetById = new Map<string, any>(assets.map((a: any) => [a.id, a]));
    // Newest first, so the first row seen for a pair (either direction) is its latest verification
    const latestPair = new Map<string, (typeof pairVers)[number]>();
    for (const pv of pairVers) {
      const key = [pv.beforeAssetId, pv.afterAssetId].sort().join("|");
      if (!latestPair.has(key)) latestPair.set(key, pv);
    }

    const hydrated = await Promise.all(
      comparisons.map(async (comp: any) => {
        const beforeAsset = assetById.get(comp.beforeAssetId) ?? null;
        const afterAsset = assetById.get(comp.afterAssetId) ?? null;
        const pairVer = latestPair.get([comp.beforeAssetId, comp.afterAssetId].sort().join("|")) ?? null;

        const verified = pairVer
          ? Boolean(pairVer.sameScene && pairVer.confidence >= 0.7)
          : comp.verified;
        const matchConfidence = pairVer ? pairVer.confidence : comp.matchConfidence;
        const aiReason = pairVer ? pairVer.reason : comp.aiReason;
        const changeSummary = pairVer ? pairVer.visibleChange : comp.changeSummary;

        return {
          ...comp,
          verified,
          matchConfidence,
          aiReason,
          changeSummary,
          beforeAsset: beforeAsset
            ? {
                ...beforeAsset,
                normalizedUrl: getNormalizedComparisonUrl(beforeAsset.secureUrl),
              }
            : null,
          afterAsset: afterAsset
            ? {
                ...afterAsset,
                normalizedUrl: getNormalizedComparisonUrl(afterAsset.secureUrl),
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: hydrated.length,
      comparisons: hydrated,
    });
  } catch (error: any) {
    console.error("GET /api/comparisons error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch comparisons" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      beforeAssetId,
      afterAssetId,
      notes,
      createdBy,
      saveAnyway,
      verified: callerVerified,
      matchConfidence: callerConfidence,
      aiReason: callerReason,
      changeSummary: callerChangeSummary,
    } = body;

    if (!projectId || !beforeAssetId || !afterAssetId) {
      return NextResponse.json(
        {
          success: false,
          error: "projectId, beforeAssetId, and afterAssetId are required",
        },
        { status: 400 }
      );
    }

    if (beforeAssetId === afterAssetId) {
      return NextResponse.json(
        { success: false, error: "Cannot compare an asset with itself" },
        { status: 400 }
      );
    }

    // Verify assets exist
    let [assetA, assetB] = await Promise.all([
      db.mediaAsset.findUnique({
        where: { id: beforeAssetId },
        include: { aiTags: { orderBy: { confidence: "desc" } } },
      }),
      db.mediaAsset.findUnique({
        where: { id: afterAssetId },
        include: { aiTags: { orderBy: { confidence: "desc" } } },
      }),
    ]);

    if (!assetA || !assetB) {
      return NextResponse.json(
        { success: false, error: "One or both media assets could not be found" },
        { status: 404 }
      );
    }

    // Hard Rule: Always order before/after by capturedAt automatically
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
      const tA = new Date(assetA.createdAt).getTime();
      const tB = new Date(assetB.createdAt).getTime();
      if (tA > tB) {
        beforeAsset = assetB;
        afterAsset = assetA;
      }
    }

    let isVerified = false;
    let matchConfidence: number | null = null;
    let aiReason: string | null = null;
    let changeSummary: string | null = null;

    // Check if there is already a cached verification
    const cached = await db.pairVerification.findUnique({
      where: {
        beforeAssetId_afterAssetId: {
          beforeAssetId: beforeAsset.id,
          afterAssetId: afterAsset.id,
        },
      },
    });

    if (saveAnyway) {
      // User opted to save manually despite failed checks or unverified status
      isVerified = Boolean(callerVerified ?? (cached?.sameScene && (cached.confidence >= COMPARISON_CONFIG.MIN_VISION_CONFIDENCE)));
      matchConfidence = callerConfidence ?? (cached?.confidence ?? null);
      aiReason = callerReason ?? (cached?.reason ?? (body.warningReason || "Saved manually without full verification"));
      changeSummary = callerChangeSummary ?? (cached?.visibleChange ?? null);
    } else {
      // Step 0: Integrity Engine: a flagged (or reviewer-rejected) photo is not evidence
      const integrity = await prisma.assetIntegrity
        .findMany({
          where: { assetId: { in: [beforeAsset.id, afterAsset.id] } },
          select: { assetId: true, status: true, verdict: true, reviewDecision: true, trustScore: true },
        })
        .catch(() => []);
      const flagged = integrity.filter((i) => effectiveVerdict(i) === "FLAGGED");
      if (flagged.length > 0) {
        const which = flagged.map((f) => (f.assetId === beforeAsset.id ? "before" : "after")).join(" and ");
        return NextResponse.json({
          success: false,
          warning: true,
          needsConfirmation: true,
          reason: `The ${which} photo was flagged by the Integrity Engine (Trust Score ${flagged.map((f) => f.trustScore).join(", ")}). Review it before using it as evidence.`,
          orderedBeforeId: beforeAsset.id,
          orderedAfterId: afterAsset.id,
        });
      }

      // Step 1: Check Hard Rules
      const hardCheck = checkHardRules(beforeAsset, afterAsset);
      if (!hardCheck.passed) {
        return NextResponse.json({
          success: false,
          warning: true,
          needsConfirmation: true,
          reason: hardCheck.reason || "These photos do not satisfy date or location rules for comparison",
          orderedBeforeId: beforeAsset.id,
          orderedAfterId: afterAsset.id,
        });
      }

      // Step 2: Check Content Similarity Gate
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

      if (!contentCheck.passed) {
        return NextResponse.json({
          success: false,
          warning: true,
          needsConfirmation: true,
          reason: contentCheck.reason || "Content similarity between these photos is too low",
          orderedBeforeId: beforeAsset.id,
          orderedAfterId: afterAsset.id,
        });
      }

      // Step 3: Vision Verification (OpenAI GPT-4o-mini + PairVerification cache)
      const vision = await verifyPairWithVision(beforeAsset, afterAsset);

      if (!vision.sameScene || vision.confidence < COMPARISON_CONFIG.MIN_VISION_CONFIDENCE) {
        const failureReason = !vision.sameScene
          ? `These photos do not look like the same scene: ${vision.reason}`
          : `Vision match confidence is ${(vision.confidence * 100).toFixed(0)}% (minimum ${(COMPARISON_CONFIG.MIN_VISION_CONFIDENCE * 100).toFixed(0)}% required). ${vision.reason}`;

        return NextResponse.json({
          success: false,
          warning: true,
          needsConfirmation: true,
          reason: failureReason,
          verification: vision,
          orderedBeforeId: beforeAsset.id,
          orderedAfterId: afterAsset.id,
        });
      }

      isVerified = true;
      matchConfidence = vision.confidence;
      aiReason = vision.reason;
      changeSummary = vision.visibleChange;
    }

    const comparison = await db.comparison.create({
      data: {
        projectId,
        beforeAssetId: beforeAsset.id,
        afterAssetId: afterAsset.id,
        notes: notes || null,
        verified: isVerified,
        matchConfidence,
        aiReason,
        changeSummary,
        createdBy: createdBy || "usr_demo123",
      },
    });

    // Retrofit audit log: used_in_comparison for both assets
    await Promise.all([
      logEvent(
        beforeAsset.id,
        "used_in_comparison",
        { comparisonId: comparison.id, counterpartId: afterAsset.id, role: "before", verified: isVerified },
        comparison.createdBy
      ),
      logEvent(
        afterAsset.id,
        "used_in_comparison",
        { comparisonId: comparison.id, counterpartId: beforeAsset.id, role: "after", verified: isVerified },
        comparison.createdBy
      ),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Comparison pair saved successfully",
        comparison: {
          ...comparison,
          beforeAsset: {
            ...beforeAsset,
            normalizedUrl: getNormalizedComparisonUrl(beforeAsset.secureUrl),
          },
          afterAsset: {
            ...afterAsset,
            normalizedUrl: getNormalizedComparisonUrl(afterAsset.secureUrl),
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/comparisons error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save comparison" },
      { status: 500 }
    );
  }
}
