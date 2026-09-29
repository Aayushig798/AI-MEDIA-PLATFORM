import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { createAnchor } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const anchors = await db.merkleAnchor.findMany({ orderBy: { toSeq: "desc" } });
    return NextResponse.json({ success: true, anchors });
  } catch (error: any) {
    console.error("GET /api/ledger/anchor error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to list anchors" }, { status: 500 });
  }
}

/** Seal all entries since the last anchor under a Merkle root (run daily, e.g. from a cron). */
export async function POST() {
  try {
    const actor = await getActor();
    const anchor = await createAnchor(actor.label);
    if (!anchor) {
      return NextResponse.json({ success: true, anchor: null, message: "No new entries since the last anchor" });
    }
    return NextResponse.json({ success: true, anchor }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/ledger/anchor error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create anchor" }, { status: 500 });
  }
}
