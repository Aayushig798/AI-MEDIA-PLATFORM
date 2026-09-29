import { NextRequest, NextResponse } from "next/server";
import { db, prisma } from "@/lib/db";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { parseProjectIntegrityFields } from "@/lib/project-fields";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

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
            integrity: { select: INTEGRITY_SUMMARY },
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

/** Update the Integrity Engine inputs: site coordinates, geofence, impact type, claim. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fields = parseProjectIntegrityFields(await req.json());
    if ("error" in fields) {
      return NextResponse.json({ success: false, error: fields.error }, { status: 400 });
    }
    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }
    const project = await prisma.project.update({ where: { id: params.id }, data: fields.data });
    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error(`PATCH /api/projects/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update project" },
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
