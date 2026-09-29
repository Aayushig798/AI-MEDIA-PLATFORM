import { NextRequest, NextResponse } from "next/server";
import { suggestComparisons } from "@/lib/comparisons";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const suggestions = await suggestComparisons(params.id);
    return NextResponse.json({ success: true, suggestions });
  } catch (error: any) {
    console.error(`GET /api/projects/${params.id}/suggested-comparisons error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to suggest comparisons" }, { status: 500 });
  }
}
