import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assembleProjectFacts } from "@/lib/reports/factAssembly";
import { generateNarrative } from "@/lib/reports/narrativeGen";
import { logEvent } from "@/lib/audit/logEvent";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const reports = await db.report.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, count: reports.length, reports });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/reports error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { title, selectedAssetIds: inputAssetIds, createdBy } = body;

    const session = await getServerSession(authOptions);
    const author = createdBy || (session?.user as any)?.id || "usr_demo123";

    // 1. Assemble structured empirical facts without AI
    const facts = await assembleProjectFacts(projectId);

    // 2. Generate grounded narrative from facts
    const narrative = await generateNarrative(facts);

    // 3. Resolve selected asset IDs (either passed explicitly or auto-select all project assets)
    let selectedAssetIds = inputAssetIds;
    if (!selectedAssetIds || !Array.isArray(selectedAssetIds) || selectedAssetIds.length === 0) {
      const allAssets = await db.mediaAsset.findMany({
        where: { projectId },
        select: { id: true },
      });
      selectedAssetIds = allAssets.map((a: any) => a.id);
    }

    // 4. Save Report record
    const reportTitle =
      title ||
      `${facts.projectName} — Impact Intelligence Report (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`;

    const report = await db.report.create({
      data: {
        projectId,
        title: reportTitle,
        generatedSummary: narrative,
        selectedAssetIds,
        createdBy: author,
      },
    });

    // 5. Retrofit audit log: log used_in_report for every selected asset
    await Promise.all(
      selectedAssetIds.map((assetId: string) =>
        logEvent(
          assetId,
          "used_in_report",
          {
            reportId: report.id,
            reportTitle: report.title,
            createdAt: report.createdAt,
          },
          author
        )
      )
    );

    return NextResponse.json(
      {
        success: true,
        message: "Impact report generated and saved successfully",
        report,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/projects/[id]/reports error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
