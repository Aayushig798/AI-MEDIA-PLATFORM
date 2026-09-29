import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { appendLedger } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
    }
    const comparisons = await db.comparison.findMany({
      where: { projectId },
      include: { metrics: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    const ids = Array.from(new Set(comparisons.flatMap((c) => [c.beforeAssetId, c.afterAssetId])));
    const assets = await db.mediaAsset.findMany({
      where: { id: { in: ids } },
      select: { id: true, secureUrl: true, resourceType: true, capturedAt: true, manualLocation: true },
    });
    return NextResponse.json({ success: true, comparisons, assets });
  } catch (error: any) {
    console.error("GET /api/comparisons error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to list comparisons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, beforeAssetId, afterAssetId, note } = await req.json();
    if (!projectId || !beforeAssetId || !afterAssetId || beforeAssetId === afterAssetId) {
      return NextResponse.json(
        { success: false, error: "projectId and two different asset ids are required" },
        { status: 400 }
      );
    }

    const [before, after] = await Promise.all([
      db.mediaAsset.findUnique({ where: { id: beforeAssetId }, include: { integrity: true } }),
      db.mediaAsset.findUnique({ where: { id: afterAssetId }, include: { integrity: true } }),
    ]);
    if (!before || !after || before.projectId !== projectId || after.projectId !== projectId) {
      return NextResponse.json({ success: false, error: "Both assets must belong to this project" }, { status: 400 });
    }
    if (before.resourceType !== "image" || after.resourceType !== "image") {
      return NextResponse.json({ success: false, error: "Comparisons need two still images" }, { status: 400 });
    }
    if (before.capturedAt && after.capturedAt && before.capturedAt >= after.capturedAt) {
      return NextResponse.json({ success: false, error: "The 'before' photo must be captured earlier than the 'after' photo" }, { status: 400 });
    }

    const existing = await db.comparison.findFirst({ where: { projectId, beforeAssetId, afterAssetId } });
    if (existing) return NextResponse.json({ success: true, comparison: existing });

    const actor = await getActor();
    const comparison = await db.comparison.create({
      data: { projectId, beforeAssetId, afterAssetId, note: note?.trim() || null, createdBy: actor.id },
    });

    // One entry per side so both assets' histories show they were used.
    for (const [role, asset] of [["before", before], ["after", after]] as const) {
      await appendLedger({
        type: "COMPARISON_CREATED",
        actor: actor.label,
        assetId: asset.id,
        projectId,
        payload: {
          comparisonId: comparison.id,
          role,
          beforeAssetId,
          afterAssetId,
          trustScore: asset.integrity?.trustScore ?? null,
          verdict: asset.integrity?.verdict ?? null,
        },
      });
    }

    return NextResponse.json({ success: true, comparison }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/comparisons error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create comparison" }, { status: 500 });
  }
}
