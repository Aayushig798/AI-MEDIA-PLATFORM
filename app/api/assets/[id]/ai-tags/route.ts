import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    // Status, tags and categories in a single query
    const asset = await db.mediaAsset.findUnique({
      where: { id },
      select: {
        aiProcessingStatus: true,
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Media asset not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      aiProcessingStatus: asset.aiProcessingStatus,
      aiTags: asset.aiTags || [],
      categories: (asset.categories || []).map((c: any) => c.category?.name || c.name || "").filter(Boolean),
    });
  } catch (error: any) {
    console.error(`GET /api/assets/${params.id}/ai-tags error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch AI tags" },
      { status: 500 }
    );
  }
}

