import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";

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
    const { manualCategory, manualLocation, manualNotes, capturedAt } = body;

    const existing = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    const updated = await db.mediaAsset.update({
      where: { id },
      data: {
        manualCategory: manualCategory !== undefined ? manualCategory : existing.manualCategory,
        manualLocation: manualLocation !== undefined ? manualLocation : existing.manualLocation,
        manualNotes: manualNotes !== undefined ? manualNotes : existing.manualNotes,
        capturedAt: capturedAt !== undefined ? (capturedAt ? new Date(capturedAt) : null) : existing.capturedAt,
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
