import { NextRequest, NextResponse } from "next/server";
import { searchAssets } from "@/lib/search/vectorSearch";
import { prisma } from "@/lib/db";
import { effectiveVerdict } from "@/lib/reports/factAssembly";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, projectId, category, aiCategory, manualCategory, from, to, limit, minSimilarity, excludeFlagged } = body;

    const trimmedQuery = typeof query === "string" ? query.trim() : "";
    const hasFilters = Boolean(
      (projectId && projectId !== "ALL") ||
      (category && category !== "ALL") ||
      (aiCategory && aiCategory !== "ALL") ||
      (manualCategory && manualCategory !== "ALL") ||
      from ||
      to
    );

    if (!trimmedQuery && !hasFilters) {
      return NextResponse.json(
        { success: false, error: "Please enter a search query or select a domain / project filter" },
        { status: 400 }
      );
    }

    const results = await searchAssets(trimmedQuery, {
      projectId: projectId || undefined,
      category: (aiCategory || category) || undefined,
      aiCategory: (aiCategory || category) || undefined,
      manualCategory: manualCategory || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: Number(limit) || 24,
      minSimilarity: typeof minSimilarity === "number" ? minSimilarity : undefined,
    });

    // Integrity Engine: attach each result's Trust Score; optionally hide flagged/rejected evidence
    const integrityRows = await prisma.assetIntegrity
      .findMany({ where: { assetId: { in: results.map((r) => r.id) } }, select: { assetId: true, ...INTEGRITY_SUMMARY } })
      .catch(() => []);
    const byId = new Map(integrityRows.map((r) => [r.assetId, r]));
    const withIntegrity = results
      .map((r) => ({ ...r, integrity: byId.get(r.id) ?? null }))
      .filter((r) => !(excludeFlagged && effectiveVerdict(r.integrity) === "FLAGGED"));

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      count: withIntegrity.length,
      hiddenFlagged: results.length - withIntegrity.length,
      results: withIntegrity,
    });
  } catch (error: any) {
    console.error("POST /api/search error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Search failed" },
      { status: 500 }
    );
  }
}
