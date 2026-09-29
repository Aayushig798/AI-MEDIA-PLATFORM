import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const comparison = await db.comparison.findUnique({
      where: { id: params.id },
      include: {
        metrics: { orderBy: { createdAt: "desc" } },
        project: true,
      },
    });
    if (!comparison) {
      return NextResponse.json({ success: false, error: "Comparison not found" }, { status: 404 });
    }

    const [before, after, reels] = await Promise.all([
      db.mediaAsset.findUnique({ where: { id: comparison.beforeAssetId }, include: { integrity: { select: INTEGRITY_SUMMARY } } }),
      db.mediaAsset.findUnique({ where: { id: comparison.afterAssetId }, include: { integrity: { select: INTEGRITY_SUMMARY } } }),
      db.reel.findMany({ where: { comparisonId: comparison.id }, orderBy: { createdAt: "desc" } }),
    ]);

    return NextResponse.json({ success: true, comparison, before, after, reels });
  } catch (error: any) {
    console.error(`GET /api/comparisons/${params.id} error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load comparison" }, { status: 500 });
  }
}
