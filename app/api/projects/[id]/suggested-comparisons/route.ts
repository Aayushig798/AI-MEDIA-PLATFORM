import { NextRequest, NextResponse } from "next/server";
import { suggestComparisons } from "@/lib/search/pairing";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check project exists
    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    const result = await suggestComparisons(id);

    return NextResponse.json({
      success: true,
      projectId: id,
      projectName: project.name,
      count: result.suggestions.length,
      suggestions: result.suggestions,
      missingDateCount: result.missingDateCount,
      totalCandidatePairs: result.totalCandidatePairs,
    });
  } catch (error: any) {
    console.error(`GET /api/projects/${params.id}/suggested-comparisons error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load suggested comparisons" },
      { status: 500 }
    );
  }
}
