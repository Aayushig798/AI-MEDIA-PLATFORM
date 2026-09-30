import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Verified-by-machine is not enough for REVIEW/FLAGGED assets: a human decides. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;
    const includeDecided = searchParams.get("all") === "true";

    const assets = await db.mediaAsset.findMany({
      where: {
        ...(projectId && { projectId }),
        integrity: {
          status: "DONE",
          verdict: { in: ["REVIEW", "FLAGGED"] },
          ...(!includeDecided && { reviewDecision: null }),
        },
      },
      include: {
        integrity: true,
        project: { select: { id: true, name: true } },
        phashMatches: { orderBy: { hamming: "asc" }, take: 3 },
        webMatches: { where: { kind: { in: ["FULL", "PAGE"] } }, take: 5 },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Attach the matched assets so the queue can show them side by side.
    const matchIds = Array.from(new Set(assets.flatMap((a) => a.phashMatches.map((m) => m.matchAssetId))));
    const matched = await db.mediaAsset.findMany({
      where: { id: { in: matchIds } },
      select: { id: true, secureUrl: true, resourceType: true, capturedAt: true, project: { select: { id: true, name: true } } },
    });
    const byId = Object.fromEntries(matched.map((m) => [m.id, m]));

    return NextResponse.json({
      success: true,
      assets: assets.map((a) => ({
        ...a,
        phashMatches: a.phashMatches.map((m) => ({ ...m, match: byId[m.matchAssetId] ?? null })),
      })),
    });
  } catch (error: any) {
    console.error("GET /api/review-queue error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load review queue" }, { status: 500 });
  }
}
