import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/cloudinary-url";
import { effectiveVerdict } from "@/lib/reports/factAssembly";

export const dynamic = "force-dynamic";

/**
 * Public impact map feed: VERIFIED (or reviewer-approved) evidence only, placed
 * at the photo's own GPS when it has one, otherwise at the project site.
 */
export async function GET(req: NextRequest) {
  try {
    const projectId = new URL(req.url).searchParams.get("projectId") || undefined;
    const assets = await prisma.mediaAsset.findMany({
      where: { ...(projectId && { projectId }), integrity: { status: "DONE" } },
      include: {
        integrity: { select: { status: true, verdict: true, reviewDecision: true, trustScore: true, gpsLat: true, gpsLng: true } },
        project: { select: { id: true, name: true, latitude: true, longitude: true } },
      },
      orderBy: { capturedAt: "desc" },
    });

    const points = assets
      .filter((a) => effectiveVerdict(a.integrity) === "VERIFIED")
      .map((a) => {
        const gps =
          a.integrity?.gpsLat != null
            ? { lat: a.integrity.gpsLat, lng: a.integrity.gpsLng!, source: "photo" as const }
            : a.exifLat != null && a.exifLng != null
              ? { lat: a.exifLat, lng: a.exifLng, source: "photo" as const }
              : a.project.latitude != null && a.project.longitude != null
                ? { lat: a.project.latitude, lng: a.project.longitude, source: "project" as const }
                : null;
        if (!gps) return null;
        return {
          id: a.id,
          ...gps,
          thumbUrl: getThumbnailUrl(a.secureUrl, a.resourceType),
          trustScore: a.integrity?.trustScore ?? null,
          humanApproved: a.integrity?.reviewDecision === "APPROVED",
          capturedAt: a.capturedAt,
          category: a.manualCategory,
          projectId: a.project.id,
          projectName: a.project.name,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, points });
  } catch (error: any) {
    console.error("GET /api/map error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load map" }, { status: 500 });
  }
}
