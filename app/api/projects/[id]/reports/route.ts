import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { appendLedger } from "@/lib/ledger";
import { canonicalJSON, sha256Hex } from "@/lib/ledger-core";
import { assembleFacts } from "@/lib/reports/facts";
import { llmNarrative, templateNarrative } from "@/lib/reports/narrative";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reports = await db.report.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" }, take: 10 });
    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    console.error(`GET /api/projects/${params.id}/reports error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to list reports" }, { status: 500 });
  }
}

/** Facts first (no AI), then a narrative strictly grounded in them. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await db.project.findUnique({ where: { id: params.id }, select: { name: true } });
    if (!project) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

    const facts = await assembleFacts(params.id);
    const llm = await llmNarrative(facts);
    const narrative = "text" in llm ? llm.text : templateNarrative(facts);
    const narrativeBy = "text" in llm ? llm.model : "template";

    const factsJson = JSON.parse(JSON.stringify(facts)) as Prisma.InputJsonValue;
    const report = await db.report.create({
      data: {
        projectId: params.id,
        title: `${project.name}: verified impact report`,
        facts: factsJson,
        narrative,
        narrativeBy,
        citedAssetIds: facts.cited.map((c) => c.id),
      },
    });

    const actor = await getActor();
    const factsDigest = await sha256Hex(canonicalJSON(factsJson));
    for (const assetId of report.citedAssetIds) {
      await appendLedger({
        type: "REPORT_GENERATED",
        actor: actor.label,
        assetId,
        projectId: params.id,
        payload: { reportId: report.id, factsDigest, narrativeBy },
      });
    }

    return NextResponse.json(
      { success: true, report, llmNote: "rejected" in llm ? llm.rejected : null },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(`POST /api/projects/${params.id}/reports error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
