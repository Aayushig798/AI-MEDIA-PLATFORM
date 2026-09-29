import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({
      where: { id },
      include: {
        assets: {
          orderBy: { createdAt: "desc" },
          include: {
            aiTags: true,
            categories: { include: { category: true } },
          },
        },
        _count: { select: { assets: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error(`GET /api/projects/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch project" },
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
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({
      where: { id },
      include: { assets: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Destroy all associated Cloudinary assets first
    const assets = (project as any).assets || [];
    for (const asset of assets) {
      try {
        await destroyCloudinaryAsset(asset.cloudinaryPublicId, asset.resourceType);
      } catch (cldErr) {
        console.warn(`Could not destroy Cloudinary asset ${asset.cloudinaryPublicId}:`, cldErr);
      }
    }

    // Delete project from database (cascades to assets, tags, categories)
    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Project '${project.name}' and ${assets.length} associated media asset(s) were permanently deleted.`,
      deletedId: id,
    });
  } catch (error: any) {
    console.error(`DELETE /api/projects/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete project" },
      { status: 500 }
    );
  }
}
