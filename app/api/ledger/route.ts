import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 5000;

/**
 * Public, read-only ledger feed. With no filter it returns the chain in order
 * so a browser can re-verify it end to end.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 500, MAX_LIMIT);
    const order = searchParams.get("order") === "desc" ? "desc" : "asc";

    const entries = await db.ledgerEntry.findMany({
      where: { ...(assetId && { assetId }), ...(projectId && { projectId }) },
      orderBy: { seq: order },
      take: limit,
    });
    const total = await db.ledgerEntry.count();

    return NextResponse.json({ success: true, entries, total });
  } catch (error: any) {
    console.error("GET /api/ledger error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to read ledger" }, { status: 500 });
  }
}
