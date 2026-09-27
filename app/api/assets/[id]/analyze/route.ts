import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runVisionFallback } from "@/lib/ai/visionFallback";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const asset = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Media asset not found" },
        { status: 404 }
      );
    }

    // Run AI analysis / re-analysis
    const result = await runVisionFallback(asset.id, asset.secureUrl, {
      manualNotes: asset.manualNotes || undefined,
      manualLocation: asset.manualLocation || undefined,
    });

    const refreshedAsset = await db.mediaAsset.findUnique({
      where: { id },
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "AI analysis completed successfully",
      asset: refreshedAsset,
      aiTags: refreshedAsset?.aiTags || [],
      categories: refreshedAsset?.categories?.map((c: any) => c.category?.name || c.name) || [],
    });
  } catch (error: any) {
    console.error(`POST /api/assets/${params.id}/analyze error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to analyze asset" },
      { status: 500 }
    );
  }
}
