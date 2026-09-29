import { NextRequest, NextResponse } from "next/server";
import { db, prisma } from "@/lib/db";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

export const dynamic = "force-dynamic";

/** Comparison + both assets (with Trust Scores), metrics and reels, for the measure & reel studio. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const comparison = await prisma.comparison.findUnique({
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
      prisma.mediaAsset.findUnique({ where: { id: comparison.beforeAssetId }, include: { integrity: { select: INTEGRITY_SUMMARY } } }),
      prisma.mediaAsset.findUnique({ where: { id: comparison.afterAssetId }, include: { integrity: { select: INTEGRITY_SUMMARY } } }),
      prisma.reel.findMany({ where: { comparisonId: comparison.id }, orderBy: { createdAt: "desc" } }),
    ]);

    return NextResponse.json({ success: true, comparison, before, after, reels });
  } catch (error: any) {
    console.error(`GET /api/comparisons/${params.id} error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load comparison" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { notes } = body;

    const existing = await db.comparison.findMany({ where: { id } });
    if (!existing || existing.length === 0) {
      // Try single find
    }

    const updated = await db.comparison.update({
      where: { id },
      data: {
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Comparison updated successfully",
      comparison: updated,
    });
  } catch (error: any) {
    console.error(`PATCH /api/comparisons/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update comparison" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const deleted = await db.comparison.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Comparison removed successfully",
      deletedId: id,
    });
  } catch (error: any) {
    console.error(`DELETE /api/comparisons/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete comparison" },
      { status: 500 }
    );
  }
}
