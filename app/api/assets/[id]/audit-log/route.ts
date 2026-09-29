import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assetId = params.id;
    if (!assetId) {
      return NextResponse.json(
        { success: false, error: "Asset ID is required" },
        { status: 400 }
      );
    }

    const asset = await db.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        cloudinaryPublicId: true,
        secureUrl: true,
        resourceType: true,
        format: true,
        manualCategory: true,
        manualLocation: true,
        capturedAt: true,
        createdAt: true,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    const logs = await db.assetAuditLog.findMany({
      where: { mediaAssetId: assetId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      asset,
      count: logs.length,
      logs,
    });
  } catch (error: any) {
    console.error("GET /api/assets/[id]/audit-log error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch asset audit log" },
      { status: 500 }
    );
  }
}
