import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { runIntegrity } from "@/lib/integrity/run";

// Web detection + AI Vision + weather + satellite can take several seconds.
export const maxDuration = 60;

/**
 * "Submit for verification": runs every Integrity Engine check for one asset.
 * External checks cost free-tier quota, so they only run on this explicit call.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const asset = await db.mediaAsset.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!asset) {
      return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
    }

    const actor = await getActor();
    const integrity = await runIntegrity(params.id, actor.label);
    if (integrity.status === "ERROR") {
      return NextResponse.json({ success: false, error: integrity.error, integrity }, { status: 502 });
    }
    return NextResponse.json({ success: true, integrity });
  } catch (error: any) {
    console.error(`POST /api/assets/${params.id}/verify error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Verification failed" }, { status: 500 });
  }
}
