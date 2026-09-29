import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assembleProjectFacts, effectiveVerdict } from "@/lib/reports/factAssembly";
import { prisma } from "@/lib/db";
import { publicBaseUrl } from "@/lib/cloudinary";
import { withTransformation } from "@/lib/cloudinary-url";
import QRCode from "qrcode";
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

    // Integrity verdicts (PostgreSQL only) and QR codes to each public Verify page
    const origin = process.env.PUBLIC_BASE_URL ? publicBaseUrl()! : new URL(req.url).origin;
    const integrityRows = await prisma.assetIntegrity
      .findMany({
        where: { asset: { projectId: report.projectId } },
        select: { assetId: true, status: true, verdict: true, reviewDecision: true, trustScore: true },
      })
      .catch(() => []);
    const integrityById = new Map(integrityRows.map((r) => [r.assetId, r]));
    const verdictOf = (id: string) => effectiveVerdict(integrityById.get(id));
    const qrFor = (assetId: string) =>
      QRCode.toDataURL(`${origin}/verify/${assetId}`, { width: 160, margin: 1 }).catch(() => null);
    // Print-sized, evidence-grade ("transcoded") derivative instead of the full original
    const printUrl = (url: string) => withTransformation(url, "c_fit,w_900/f_jpg,q_auto");

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

        const measuredFact = facts.measuredChanges.find((m) => m.comparisonId === c.id);
        const measured = measuredFact
          ? `${measuredFact.metric === "GREEN_COVER" ? "Green cover" : "Water area"} ${measuredFact.beforePct}% → ${measuredFact.afterPct}% (${measuredFact.deltaPp > 0 ? "+" : ""}${measuredFact.deltaPp} pp)`
          : null;

        return {
          id: c.id,
          flagged: verdictOf(c.beforeAssetId) === "FLAGGED" || verdictOf(c.afterAssetId) === "FLAGGED",
          measured,
          qrDataUrl: after ? await qrFor(after.id) : null,
          beforeUrl: before?.secureUrl ? printUrl(before.secureUrl) : "",
          afterUrl: after?.secureUrl ? printUrl(after.secureUrl) : "",
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

    const formattedAssets = await Promise.all(selectedAssets.map(async (a: any) => ({
      id: a.id,
      url: printUrl(a.secureUrl),
      trustScore: integrityById.get(a.id)?.trustScore ?? null,
      verdict: verdictOf(a.id),
      qrDataUrl: await qrFor(a.id),
      category: a.manualCategory,
      location: a.manualLocation,
      capturedAt: a.capturedAt ? a.capturedAt.toISOString() : null,
      tags: a.aiTags?.map((t: any) => t.label) || [],
    })));

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
      // Pairs involving a flagged photo are never presented as evidence
      comparisons: enrichedComparisons.filter((c) => c.beforeUrl && c.afterUrl && !c.flagged),
      selectedAssets: formattedAssets.filter((a) => a.verdict !== "FLAGGED"),
      integrity: facts.integrity,
      ledger: facts.ledger,
      verifyBaseUrl: origin,
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
