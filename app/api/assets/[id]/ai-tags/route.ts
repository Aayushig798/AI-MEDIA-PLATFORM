import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
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

    // Explicitly read directly from the AiTag table
    const aiTags = await db.aiTag.findMany({
      where: { mediaAssetId: id },
      orderBy: { confidence: "desc" },
    });

    // Read categories from MediaAssetCategory table
    const mediaCategories = await db.mediaAssetCategory.findMany({
      where: { mediaAssetId: id },
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      aiProcessingStatus: asset.aiProcessingStatus,
      aiTags: aiTags || [],
      categories: mediaCategories.map((c: any) => c.category?.name || c.name || "").filter(Boolean),
    });
  } catch (error: any) {
    console.error(`GET /api/assets/${params.id}/ai-tags error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch AI tags" },
      { status: 500 }
    );
  }
}

