import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { getActor } from "@/lib/auth";
import { tryAppendLedger } from "@/lib/ledger";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const asset = await db.mediaAsset.findUnique({
      where: { id },
      include: {
        integrity: true,
        webMatches: { orderBy: { kind: "asc" } },
        derived: { orderBy: { createdAt: "desc" } },
      },
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

const EDITABLE = ["manualCategory", "manualLocation", "manualNotes", "capturedAt", "claimText"] as const;
// Changing these invalidates a previous verdict: the checks compare against them.
const EVIDENCE_FIELDS = new Set(["capturedAt", "claimText"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const existing = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of EDITABLE) {
      if (body[field] === undefined) continue;
      let next: unknown = body[field];
      if (field === "capturedAt") next = body[field] ? new Date(body[field]) : null;
      else if (typeof next === "string") next = next.trim() || null;

      const prev = existing[field];
      const same =
        prev instanceof Date && next instanceof Date ? prev.getTime() === next.getTime() : prev === next;
      if (!same) {
        data[field] = next;
        changes[field] = { from: prev, to: next };
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ success: true, asset: existing });
    }

    const updated = await db.mediaAsset.update({
      where: { id },
      data,
      include: { integrity: { select: { status: true, trustScore: true, verdict: true, reviewDecision: true, computedAt: true } } },
    });

    if (Object.keys(changes).some((f) => EVIDENCE_FIELDS.has(f))) {
      await db.assetIntegrity.updateMany({ where: { assetId: id }, data: { status: "PENDING" } });
    }

    const actor = await getActor();
    await tryAppendLedger({
      type: "METADATA_EDITED",
      actor: actor.label,
      assetId: id,
      projectId: existing.projectId,
      payload: { changes },
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

    // Step 2: Now that Cloudinary deletion succeeded, remove from DB.
    // Comparisons reference assets by id without a FK, so drop those first.
    await db.comparison.deleteMany({
      where: { OR: [{ beforeAssetId: id }, { afterAssetId: id }] },
    });
    await db.phashMatch.deleteMany({ where: { matchAssetId: id } });
    await db.mediaAsset.delete({
      where: { id },
    });

    // The ledger keeps the asset's history; this entry records its removal.
    const actor = await getActor();
    await tryAppendLedger({
      type: "ASSET_DELETED",
      actor: actor.label,
      assetId: id,
      projectId: asset.projectId,
      payload: { cloudinaryPublicId: asset.cloudinaryPublicId, sha256: asset.sha256 },
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
