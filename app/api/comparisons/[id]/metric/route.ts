import { NextRequest, NextResponse } from "next/server";
import type { MetricKind, Prisma } from "@prisma/client";
import { prisma as db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { appendLedger } from "@/lib/ledger";
import { uploadGenerated, isCloudinaryConfigured } from "@/lib/cloudinary";
import { overlayId } from "@/lib/cloudinary-url";
import { registerDerivative } from "@/lib/derivatives";
import { METHODS, COMPARE_FRAME } from "@/lib/change-metric";
import { satelliteConfigured, satelliteDelta } from "@/lib/integrity/checks/satellite";

export const maxDuration = 60;

const KINDS: MetricKind[] = ["GREEN_COVER", "WATER_AREA"];
const MAX_MASK_CHARS = 8 * 1024 * 1024;

function pct(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : null;
}

/**
 * Save a pixel-measured change metric: the browser computes the percentages and
 * the change mask; the server stores the mask on Cloudinary, cross-checks the
 * direction against Sentinel-2, and ledgers the result.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const metric = body.metric as MetricKind;
    const beforePct = pct(body.beforePct);
    const afterPct = pct(body.afterPct);
    if (!KINDS.includes(metric) || beforePct === null || afterPct === null) {
      return NextResponse.json({ success: false, error: "metric, beforePct and afterPct (0–100) are required" }, { status: 400 });
    }
    if (typeof body.maskDataUrl !== "string" || !body.maskDataUrl.startsWith("data:image/png;base64,") || body.maskDataUrl.length > MAX_MASK_CHARS) {
      return NextResponse.json({ success: false, error: "maskDataUrl must be a PNG data URL under 8 MB" }, { status: 400 });
    }
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ success: false, error: "Cloudinary is not configured" }, { status: 500 });
    }

    const comparison = await db.comparison.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!comparison) return NextResponse.json({ success: false, error: "Comparison not found" }, { status: 404 });
    const [before, after] = await Promise.all([
      db.mediaAsset.findUniqueOrThrow({ where: { id: comparison.beforeAssetId }, include: { integrity: true } }),
      db.mediaAsset.findUniqueOrThrow({ where: { id: comparison.afterAssetId }, include: { integrity: true } }),
    ]);

    const suffix = metric === "GREEN_COVER" ? "green" : "water";
    const mask = await uploadGenerated(body.maskDataUrl, `impact-platform/${comparison.projectId}/masks/${comparison.id}_${suffix}`);

    // Independent consistency check from orbit, when a site and dates exist.
    let satDelta: Prisma.InputJsonValue | undefined;
    const site =
      after.integrity?.gpsLat != null
        ? { lat: after.integrity.gpsLat, lng: after.integrity.gpsLng! }
        : comparison.project.latitude != null
          ? { lat: comparison.project.latitude, lng: comparison.project.longitude! }
          : null;
    if (satelliteConfigured() && site && before.capturedAt && after.capturedAt) {
      try {
        const sat = await satelliteDelta(site.lat, site.lng, before.capturedAt, after.capturedAt, metric === "GREEN_COVER" ? "ndvi" : "ndwi");
        const deltaPp = afterPct - beforePct;
        const agrees = sat.delta === null ? null : Math.sign(sat.delta) === Math.sign(deltaPp) || Math.abs(sat.delta) < 0.03;
        satDelta = { ...sat, agrees };
      } catch (err: any) {
        satDelta = { error: err.message };
      }
    }

    const actor = await getActor();
    const deltaPp = Math.round((afterPct - beforePct) * 10) / 10;
    const created = await db.changeMetric.create({
      data: {
        comparisonId: comparison.id,
        metric,
        beforePct,
        afterPct,
        deltaPp,
        method: `${METHODS[metric].method}; ${METHODS[metric].errorBand} expected error`,
        maskPublicId: mask.publicId,
        maskUrl: mask.secureUrl,
        alignment: body.alignment ?? undefined,
        satDelta,
      },
    });

    // The highlighted-regrowth view is an "edited" derivative: illustrative, not evidence.
    await registerDerivative(after, `${COMPARE_FRAME}/l_${overlayId(mask.publicId)},o_70/fl_layer_apply`, `change mask (${suffix})`, actor.label);

    await appendLedger({
      type: "METRIC_MEASURED",
      actor: actor.label,
      assetId: after.id,
      projectId: comparison.projectId,
      payload: {
        comparisonId: comparison.id,
        metricId: created.id,
        metric,
        beforePct,
        afterPct,
        deltaPp,
        method: created.method,
        maskPublicId: mask.publicId,
        beforeAssetId: before.id,
        afterAssetId: after.id,
        beforeSha256: before.sha256,
        afterSha256: after.sha256,
        alignment: body.alignment ?? null,
        satDelta: satDelta ?? null,
      },
    });

    return NextResponse.json({ success: true, metric: created }, { status: 201 });
  } catch (error: any) {
    console.error(`POST /api/comparisons/${params.id}/metric error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to save metric" }, { status: 500 });
  }
}
