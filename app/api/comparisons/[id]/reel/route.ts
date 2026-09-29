import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { appendLedger } from "@/lib/ledger";
import { isCloudinaryConfigured, publicBaseUrl } from "@/lib/cloudinary";
import { buildReel, ReelAspect, REEL_DIMENSIONS } from "@/lib/reel";

export const maxDuration = 120;

type WithIntegrity = { integrity: { status: string; verdict: string | null; reviewDecision: string | null; trustScore: number | null } | null };

/** Evidence may go into campaign content only if it passed (or a human approved it). */
function blockedReason(asset: WithIntegrity, role: string): string | null {
  const i = asset.integrity;
  if (!i || i.status !== "DONE") return `The ${role} photo has not been verified yet.`;
  if (i.reviewDecision === "REJECTED") return `The ${role} photo was rejected by a reviewer.`;
  if (i.reviewDecision !== "APPROVED" && i.verdict === "FLAGGED") return `The ${role} photo is flagged; review it first.`;
  return null;
}

function origin(): string {
  const configured = publicBaseUrl();
  if (process.env.PUBLIC_BASE_URL && configured) return configured;
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { aspect = "9:16" } = await req.json().catch(() => ({}));
    if (!(aspect in REEL_DIMENSIONS)) {
      return NextResponse.json({ success: false, error: "aspect must be 9:16 or 1:1" }, { status: 400 });
    }
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ success: false, error: "Cloudinary is not configured" }, { status: 500 });
    }

    const comparison = await db.comparison.findUnique({
      where: { id: params.id },
      include: { project: true, metrics: { orderBy: { createdAt: "desc" } } },
    });
    if (!comparison) return NextResponse.json({ success: false, error: "Comparison not found" }, { status: 404 });

    const [before, after] = await Promise.all([
      db.mediaAsset.findUniqueOrThrow({ where: { id: comparison.beforeAssetId }, include: { integrity: true } }),
      db.mediaAsset.findUniqueOrThrow({ where: { id: comparison.afterAssetId }, include: { integrity: true } }),
    ]);
    const blocked = blockedReason(before, "before") ?? blockedReason(after, "after");
    if (blocked) return NextResponse.json({ success: false, error: blocked }, { status: 409 });

    // Field clips: verified (or approved) project videos, up to two, 3 s each.
    const videos = await db.mediaAsset.findMany({
      where: { projectId: comparison.projectId, resourceType: "video", integrity: { status: "DONE" } },
      include: { integrity: true },
      orderBy: { capturedAt: "asc" },
    });
    const clips = videos.filter((v) => !blockedReason(v, "clip")).slice(0, 2);

    const preferred = comparison.project.impactType === "WATER" ? "WATER_AREA" : "GREEN_COVER";
    const metric = comparison.metrics.find((m) => m.metric === preferred) ?? comparison.metrics[0] ?? null;

    const scores = [before, after].map((a) => a.integrity?.trustScore ?? 0);
    const trustLine = `Trust Score ${Math.min(...scores)}+ · verified ${new Date().toISOString().slice(0, 10)}`;

    const reel = await buildReel({
      project: comparison.project,
      comparisonId: comparison.id,
      before,
      after,
      metric,
      clips,
      aspect: aspect as ReelAspect,
      verifyUrl: `${origin()}/verify/${after.id}`,
      trustLine,
    });

    const sourceAssetIds = [before.id, after.id, ...clips.map((c) => c.id)];
    const saved = await db.reel.create({
      data: {
        projectId: comparison.projectId,
        comparisonId: comparison.id,
        aspect,
        deliveryUrl: reel.deliveryUrl,
        sourceAssetIds,
      },
    });

    const actor = await getActor();
    for (const assetId of sourceAssetIds) {
      await appendLedger({
        type: "REEL_RENDERED",
        actor: actor.label,
        assetId,
        projectId: comparison.projectId,
        payload: {
          reelId: saved.id,
          comparisonId: comparison.id,
          aspect,
          // Campaign content, never evidence: it crops, overlays and splices.
          class: "EDITED",
          deliveryUrl: reel.deliveryUrl,
          metricId: metric?.id ?? null,
          sourceAssetIds,
        },
      });
    }

    return NextResponse.json({ success: true, reel: saved, cards: reel.cards }, { status: 201 });
  } catch (error: any) {
    console.error(`POST /api/comparisons/${params.id}/reel error:`, error);
    const message = error?.error?.message || error?.message || "Failed to build reel";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
