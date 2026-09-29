import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { tryAppendLedger } from "@/lib/ledger";

/**
 * Set the per-asset claim the AI auditor checks this photo against (overrides
 * the project claim). Changing it invalidates the previous verdict.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { claimText } = await req.json();
    const next = typeof claimText === "string" && claimText.trim() ? claimText.trim() : null;

    const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
    if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
    if (asset.claimText === next) return NextResponse.json({ success: true, asset });

    const updated = await prisma.mediaAsset.update({ where: { id: params.id }, data: { claimText: next } });
    await prisma.assetIntegrity.updateMany({ where: { assetId: params.id }, data: { status: "PENDING" } });

    const actor = await getActor();
    await tryAppendLedger({
      type: "METADATA_EDITED",
      actor: actor.label,
      assetId: asset.id,
      projectId: asset.projectId,
      payload: { changes: { claimText: { from: asset.claimText, to: next } } },
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (error: any) {
    console.error(`PUT /api/assets/${params.id}/claim error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to save claim" }, { status: 500 });
  }
}
