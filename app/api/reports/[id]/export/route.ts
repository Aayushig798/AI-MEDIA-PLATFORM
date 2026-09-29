import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assembleProjectFacts } from "@/lib/reports/factAssembly";
import { buildReportHtml, renderReportPdf } from "@/lib/reports/pdfExport";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;
    if (!reportId) {
      return NextResponse.json(
        { success: false, error: "Report ID is required" },
        { status: 400 }
      );
    }

    const report = await db.report.findUnique({
      where: { id: reportId },
      include: { project: true },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    // Assemble facts
    const facts = await assembleProjectFacts(report.projectId);

    // Fetch comparisons
    const comparisons = await db.comparison.findMany({
      where: { projectId: report.projectId },
      orderBy: { createdAt: "desc" },
    });

    const enrichedComparisons = await Promise.all(
      comparisons.map(async (c: any) => {
        const [before, after] = await Promise.all([
          db.mediaAsset.findUnique({ where: { id: c.beforeAssetId } }),
          db.mediaAsset.findUnique({ where: { id: c.afterAssetId } }),
        ]);

        return {
          id: c.id,
          beforeUrl: before?.secureUrl || "",
          afterUrl: after?.secureUrl || "",
          beforeDate: before?.capturedAt
            ? new Date(before.capturedAt).toISOString().split("T")[0]
            : null,
          afterDate: after?.capturedAt
            ? new Date(after.capturedAt).toISOString().split("T")[0]
            : null,
          location: before?.manualLocation || after?.manualLocation || null,
          verified: Boolean(c.verified),
          changeSummary: c.changeSummary,
          aiReason: c.aiReason,
        };
      })
    );

    // Fetch selected assets
    const selectedAssets = await db.mediaAsset.findMany({
      where: {
        id: { in: report.selectedAssetIds || [] },
        resourceType: "image",
      },
      include: { aiTags: true },
      take: 6,
    });

    const formattedAssets = selectedAssets.map((a: any) => ({
      id: a.id,
      url: a.secureUrl,
      category: a.manualCategory,
      location: a.manualLocation,
      capturedAt: a.capturedAt ? a.capturedAt.toISOString() : null,
      tags: a.aiTags?.map((t: any) => t.label) || [],
    }));

    // Build print HTML
    const html = buildReportHtml({
      projectName: report.project.name,
      projectLocation: report.project.location,
      reportTitle: report.title || `${report.project.name} Impact Report`,
      generatedSummary: report.generatedSummary,
      createdAt: report.createdAt,
      metrics: {
        totalAssets: facts.totalAssets,
        categoryBreakdown: facts.categoryBreakdown,
        dateRange: facts.dateRange,
        verifiedComparisonsCount: facts.verifiedComparisonsCount,
        totalComparisons: facts.totalComparisons,
      },
      comparisons: enrichedComparisons.filter(c => c.beforeUrl && c.afterUrl),
      selectedAssets: formattedAssets,
    });

    // Render PDF with Puppeteer
    const pdfBuffer = await renderReportPdf(html);

    const filename = `${report.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-impact-report.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("GET /api/reports/[id]/export error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to export report PDF" },
      { status: 500 }
    );
  }
}
