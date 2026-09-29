import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COMPARISON_CONFIG } from "@/lib/comparison/config";

export async function POST(req: NextRequest) {
  try {
    let projectId: string | undefined;
    try {
      const body = await req.json();
      projectId = body?.projectId;
    } catch {
      const { searchParams } = new URL(req.url);
      projectId = searchParams.get("projectId") || undefined;
    }

    // Find all comparisons matching verified = false
    const candidates = await db.comparison.findMany({
      where: projectId ? { projectId, verified: false } : { verified: false },
    });

    // Filter those with matchConfidence < CLEANUP_CONFIDENCE_THRESHOLD (0.3)
    const threshold = COMPARISON_CONFIG.CLEANUP_CONFIDENCE_THRESHOLD;
    const toDelete = candidates.filter(
      (c: any) =>
        c.verified === false &&
        typeof c.matchConfidence === "number" &&
        c.matchConfidence < threshold
    );

    const deletedIds: string[] = [];
    for (const item of toDelete) {
      await db.comparison.delete({ where: { id: item.id } });
      deletedIds.push(item.id);
    }

    console.log(
      `[Cleanup Route] Cleaned up ${deletedIds.length} unverified comparison(s) with confidence < ${threshold}`
    );

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedIds.length} unverified comparison(s) with match confidence under ${(threshold * 100).toFixed(0)}%.`,
      count: deletedIds.length,
      deletedIds,
    });
  } catch (error: any) {
    console.error("POST /api/comparisons/cleanup error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cleanup unverified comparisons" },
      { status: 500 }
    );
  }
}
