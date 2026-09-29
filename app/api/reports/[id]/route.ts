import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { appendLedger } from "@/lib/ledger";
import { sha256Hex } from "@/lib/ledger-core";
import { ungroundedNumbers } from "@/lib/reports/narrative";
import type { ReportFacts } from "@/lib/reports/facts";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const report = await db.report.findUnique({ where: { id: params.id } });
  if (!report) return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
  return NextResponse.json({ success: true, report });
}

/**
 * Human edits to the narrative. Numbers that aren't in the stored facts are
 * refused, so an edit can't slip an invented statistic into a verified report.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { narrative } = await req.json();
    if (typeof narrative !== "string" || !narrative.trim()) {
      return NextResponse.json({ success: false, error: "narrative is required" }, { status: 400 });
    }
    const report = await db.report.findUnique({ where: { id: params.id } });
    if (!report) return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });

    const bad = ungroundedNumbers(narrative, report.facts as unknown as ReportFacts);
    if (bad.length > 0) {
      return NextResponse.json(
        { success: false, error: `These numbers are not in the project facts: ${bad.join(", ")}. Reports may only state measured figures.` },
        { status: 422 }
      );
    }

    const updated = await db.report.update({ where: { id: params.id }, data: { narrative: narrative.trim() } });
    const actor = await getActor();
    await appendLedger({
      type: "REPORT_EDITED",
      actor: actor.label,
      projectId: report.projectId,
      payload: { reportId: report.id, narrativeDigest: await sha256Hex(updated.narrative) },
    });
    return NextResponse.json({ success: true, report: updated });
  } catch (error: any) {
    console.error(`PATCH /api/reports/${params.id} error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update report" }, { status: 500 });
  }
}
