import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Full Integrity Engine result for one asset (checks, review) plus its claim. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: params.id },
      select: { claimText: true, integrity: true },
    });
    if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
    return NextResponse.json({ success: true, integrity: asset.integrity, claimText: asset.claimText });
  } catch (error: any) {
    console.error(`GET /api/assets/${params.id}/integrity error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load integrity" }, { status: 500 });
  }
}
