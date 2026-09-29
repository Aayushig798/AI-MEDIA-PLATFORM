import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { determinePrimaryCategory } from "@/lib/ai/categoryMapping";

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
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    console.error(`GET /api/assets/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch asset" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { manualCategory, manualLocation, manualNotes, capturedAt, categorySource, resetToAi } = body;

    const existing = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    // Handle "Reset to AI suggestion"
    if (resetToAi) {
      const tags = await db.aiTag.findMany({
        where: { mediaAssetId: id },
        orderBy: { confidence: "desc" },
      });
      const aiPrimary = determinePrimaryCategory(tags);

      // Also ensure Category and MediaAssetCategory record reflect the AI primary category
      const cat = await db.category.upsert({
        where: { name: aiPrimary },
        update: {},
        create: { name: aiPrimary },
      });
      await db.mediaAssetCategory.deleteMany({ where: { mediaAssetId: id } });
      await db.mediaAssetCategory.create({
        data: { mediaAssetId: id, categoryId: cat.id },
      });

      const updated = await db.mediaAsset.update({
        where: { id },
        data: {
          manualCategory: aiPrimary,
          categorySource: "ai",
        },
        include: {
          aiTags: { orderBy: { confidence: "desc" } },
          categories: { include: { category: true } },
        },
      });

      return NextResponse.json({ success: true, asset: updated });
    }

    // If category changed or explicitly provided as user
    let finalCategorySource = existing.categorySource;
    if (categorySource) {
      finalCategorySource = categorySource;
    } else if (manualCategory !== undefined && manualCategory !== existing.manualCategory) {
      finalCategorySource = "user";
    }

    const updated = await db.mediaAsset.update({
      where: { id },
      data: {
        manualCategory: manualCategory !== undefined ? manualCategory : existing.manualCategory,
        categorySource: finalCategorySource,
        manualLocation: manualLocation !== undefined ? manualLocation : existing.manualLocation,
        manualNotes: manualNotes !== undefined ? manualNotes : existing.manualNotes,
        capturedAt: capturedAt !== undefined ? (capturedAt ? new Date(capturedAt) : null) : existing.capturedAt,
      },
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (error: any) {
    console.error(`PATCH /api/assets/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update asset metadata" },
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
    const asset = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    // Step 1: Must call Cloudinary's destroy API before removing DB row
    try {
      await destroyCloudinaryAsset(asset.cloudinaryPublicId, asset.resourceType);
    } catch (destroyError: any) {
      console.error(
        `Cloudinary deletion failed for ${asset.cloudinaryPublicId}. Aborting database row deletion:`,
        destroyError
      );
      // Strictly enforce: if Cloudinary deletion fails, do not delete the DB row
      return NextResponse.json(
        {
          success: false,
          error: `Cloudinary asset deletion failed: ${destroyError.message || "Unknown error"}. Database record was preserved.`,
        },
        { status: 502 }
      );
    }

    // Step 2: Now that Cloudinary deletion succeeded, remove from DB
    await db.mediaAsset.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Asset permanently deleted from Cloudinary and database",
      deletedId: id,
    });
  } catch (error: any) {
    console.error(`DELETE /api/assets/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete asset" },
      { status: 500 }
    );
  }
}
