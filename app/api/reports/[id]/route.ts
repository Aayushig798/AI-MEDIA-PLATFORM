import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assembleProjectFacts } from "@/lib/reports/factAssembly";
import { ungroundedNumbers } from "@/lib/reports/grounding";

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
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    const facts = await assembleProjectFacts(report.projectId);

    // Hydrate selected assets
    const assets = await db.mediaAsset.findMany({
      where: { id: { in: report.selectedAssetIds || [] } },
      include: { aiTags: true },
    });

    return NextResponse.json({
      success: true,
      report,
      facts,
      assets,
    });
  } catch (error: any) {
    console.error("GET /api/reports/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch report" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await req.json();
    const { generatedSummary, title, selectedAssetIds } = body;

    const existing = await db.report.findUnique({
      where: { id: reportId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    // Grounding guard: an edit may not introduce a number that isn't in the project facts.
    if (typeof generatedSummary === "string") {
      const facts = await assembleProjectFacts(existing.projectId);
      const invented = ungroundedNumbers(generatedSummary, facts);
      if (invented.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `These numbers are not in the project facts: ${invented.join(", ")}. Reports may only state measured figures.`,
          },
          { status: 422 }
        );
      }
    }

    const updateData: any = {};
    if (typeof generatedSummary === "string") {
      updateData.generatedSummary = generatedSummary;
    }
    if (typeof title === "string") {
      updateData.title = title;
    }
    if (Array.isArray(selectedAssetIds)) {
      updateData.selectedAssetIds = selectedAssetIds;
    }

    const updated = await db.report.update({
      where: { id: reportId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Report updated successfully",
      report: updated,
    });
  } catch (error: any) {
    console.error("PATCH /api/reports/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update report" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await db.report.delete({
      where: { id: reportId },
    });

    return NextResponse.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error: any) {
    console.error("DELETE /api/reports/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete report" },
      { status: 500 }
    );
  }
}
