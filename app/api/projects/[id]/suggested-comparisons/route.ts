import { NextRequest, NextResponse } from "next/server";
import { suggestComparisons } from "@/lib/search/pairing";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Existence check runs alongside the pairing work instead of before it
    const [project, result] = await Promise.all([
      db.project.findUnique({ where: { id }, select: { id: true, name: true } }),
      suggestComparisons(id),
    ]);

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      projectId: id,
      projectName: project.name,
      count: result.suggestions.length,
      suggestions: result.suggestions,
      missingDateCount: result.missingDateCount,
      missingDateAssets: result.missingDateAssets,
      totalCandidatePairs: result.totalCandidatePairs,
      totalImagesCount: result.totalImagesCount,
      noQualifyingReason: result.noQualifyingReason,
      message: result.message,
    });
  } catch (error: any) {
    console.error(`GET /api/projects/${params.id}/suggested-comparisons error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load suggested comparisons" },
      { status: 500 }
    );
  }
}
