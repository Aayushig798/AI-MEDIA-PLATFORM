import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/cloudinary-url";
import { effectiveVerdict } from "@/lib/reports/factAssembly";
import { ensureProjectSite } from "@/lib/geocode";

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

    const verified = assets.filter((a) => effectiveVerdict(a.integrity) === "VERIFIED");

    // Look up coordinates (once, then stored) for projects that only have a place name
    const needSite = new Map<string, (typeof verified)[number]["project"]>();
    for (const a of verified) if (a.project.latitude == null) needSite.set(a.project.id, a.project);
    if (needSite.size > 0) {
      const projects = await prisma.project.findMany({ where: { id: { in: Array.from(needSite.keys()) } } });
      for (const project of projects.slice(0, 10)) {
        const placed = await ensureProjectSite(project).catch(() => null);
        if (placed) for (const a of verified) if (a.project.id === project.id) Object.assign(a.project, { latitude: placed.lat, longitude: placed.lng });
      }
    }

    const points = verified
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
      .filter(Boolean) as { id: string; lat: number; lng: number; source: "photo" | "project"; projectId: string }[];

    // Photos pinned at a project's site all share one coordinate; fan them out in a small
    // spiral (a few hundred metres) so each stays visible and clickable.
    const seen = new Map<string, number>();
    for (const p of points) {
      if (p.source !== "project") continue;
      const i = seen.get(p.projectId) ?? 0;
      seen.set(p.projectId, i + 1);
      if (i === 0) continue;
      const angle = i * 2.399963; // golden angle
      const r = 0.0025 * Math.sqrt(i);
      p.lat += r * Math.sin(angle);
      p.lng += (r * Math.cos(angle)) / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
    }

    return NextResponse.json({ success: true, points });
  } catch (error: any) {
    console.error("GET /api/map error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load map" }, { status: 500 });
  }
}
