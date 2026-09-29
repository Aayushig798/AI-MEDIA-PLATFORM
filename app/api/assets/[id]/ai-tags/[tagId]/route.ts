import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; tagId: string } }
) {
  try {
    const { id, tagId } = params;

    // Verify asset exists
    const asset = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Media asset not found" },
        { status: 404 }
      );
    }

    // Delete the specific AI tag
    await db.aiTag.delete({
      where: { id: tagId },
    });

    return NextResponse.json({
      success: true,
      message: "AI tag rejected and removed successfully",
      deletedTagId: tagId,
    });
  } catch (error: any) {
    console.error(`DELETE /api/assets/${params.id}/ai-tags/${params.tagId} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to remove AI tag" },
      { status: 500 }
    );
  }
}
