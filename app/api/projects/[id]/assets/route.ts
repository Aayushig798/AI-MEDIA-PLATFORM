import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

export const dynamic = "force-dynamic";

/** All assets of a project (used by the manual before/after pair picker). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const assets = await db.mediaAsset.findMany({
      where: { projectId: params.id },
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
        integrity: { select: INTEGRITY_SUMMARY },
      },
      orderBy: { capturedAt: "asc" },
    });
    return NextResponse.json({ success: true, assets });
  } catch (error: any) {
    console.error(`GET /api/projects/${params.id}/assets error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch assets" }, { status: 500 });
  }
}
