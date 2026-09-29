import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { appendLedger } from "@/lib/ledger";

/** A human reviewer's decision on a REVIEW/FLAGGED asset. Always ledgered. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { decision, note } = await req.json();
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ success: false, error: "decision must be APPROVED or REJECTED" }, { status: 400 });
    }

    const integrity = await db.assetIntegrity.findUnique({
      where: { assetId: params.id },
      include: { asset: { select: { projectId: true } } },
    });
    if (!integrity || integrity.status !== "DONE") {
      return NextResponse.json({ success: false, error: "Run verification before reviewing this asset" }, { status: 409 });
    }

    const actor = await getActor();
    const updated = await db.assetIntegrity.update({
      where: { assetId: params.id },
      data: {
        reviewDecision: decision,
        reviewNote: typeof note === "string" && note.trim() ? note.trim() : null,
        reviewedBy: actor.label,
        reviewedAt: new Date(),
      },
    });

    await appendLedger({
      type: "REVIEW_DECISION",
      actor: actor.label,
      assetId: params.id,
      projectId: integrity.asset.projectId,
      payload: {
        decision,
        note: updated.reviewNote,
        trustScoreAtDecision: integrity.trustScore,
        verdictAtDecision: integrity.verdict,
      },
    });

    return NextResponse.json({ success: true, integrity: updated });
  } catch (error: any) {
    console.error(`POST /api/assets/${params.id}/review error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to record review" }, { status: 500 });
  }
}
