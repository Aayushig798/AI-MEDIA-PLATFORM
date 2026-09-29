import { NextRequest, NextResponse } from "next/server";
import { assembleProjectFacts } from "@/lib/reports/factAssembly";

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

    const facts = await assembleProjectFacts(projectId);
    return NextResponse.json({
      success: true,
      facts,
      // Flat properties for direct consumption by charts and dashboards
      totalAssets: facts.totalAssets,
      imageCount: facts.imageCount,
      videoCount: facts.videoCount,
      categoryBreakdown: facts.categoryBreakdown,
      dateRange: facts.dateRange,
      totalComparisons: facts.totalComparisons,
      verifiedComparisonsCount: facts.verifiedComparisonsCount,
      locations: facts.locations,
      comparisons: facts.comparisons,
      notes: facts.notes,
    });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/impact-stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to assemble impact facts" },
      { status: 500 }
    );
  }
}
