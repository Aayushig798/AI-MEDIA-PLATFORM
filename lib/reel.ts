import QRCode from "qrcode";
import type { ChangeMetric, MediaAsset, Project } from "@prisma/client";
import { cloudinary, uploadGenerated, publicBaseUrl } from "@/lib/cloudinary";
import { encodeOverlayText, overlayId } from "@/lib/cloudinary-url";

/**
 * Measured Impact Reel, built entirely from Cloudinary transformations:
 *   1. still "cards" (before/after labels, metric + change mask, QR outro) are
 *      rendered by Cloudinary image transformations and stored as assets,
 *   2. a title card becomes a video via e_zoompan (the splice base),
 *   3. everything is joined with fl_splice cross-fades in ONE delivery URL.
 *
 * Constraints found by testing: e_zoompan must be the first transformation,
 * spliced layers must share dimensions, and g_auto may appear only once in a
 * video transformation (so layers use g_center).
 */

export type ReelAspect = "9:16" | "1:1";
export const REEL_DIMENSIONS: Record<ReelAspect, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 720, h: 720 },
};

const TRANSITION = "fl_splice:transition_(name_fade;du_1)";
const IMAGE_SECONDS = 3;
const CLIP_SECONDS = 3;

interface ReelInput {
  project: Project;
  comparisonId: string;
  before: MediaAsset;
  after: MediaAsset;
  metric: ChangeMetric | null;
  clips: MediaAsset[];
  aspect: ReelAspect;
  verifyUrl: string;
  trustLine: string;
}

function cloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME!;
}

function imageUrl(transformation: string, publicId: string, ext: string) {
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${transformation}/${publicId}.${ext}`;
}

function text(value: string, size: number, extra = "") {
  return `l_text:Arial_${size}_bold:${encodeOverlayText(value)},co_white${extra}`;
}

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "undated";
}

async function renderCard(url: string, publicId: string, resourceType: "image" | "video" = "image") {
  const res = await cloudinary.uploader.upload(url, {
    public_id: publicId,
    resource_type: resourceType,
    overwrite: true,
    invalidate: true,
  });
  return res.public_id as string;
}

export function metricLine(metric: Pick<ChangeMetric, "metric" | "beforePct" | "afterPct" | "deltaPp">) {
  const label = metric.metric === "GREEN_COVER" ? "green cover" : "water area";
  const sign = metric.deltaPp > 0 ? "+" : "";
  return `${label}: ${metric.beforePct}% → ${metric.afterPct}% (${sign}${metric.deltaPp} pp)`;
}

export async function buildReel(input: ReelInput) {
  const { project, before, after, metric, clips, aspect } = input;
  const { w, h } = REEL_DIMENSIONS[aspect];
  const prefix = `impact-platform/${project.id}/reels/${input.comparisonId}_${aspect.replace(":", "x")}`;
  const wrap = `,c_fit,w_${w - 100}`;
  const frame = `c_fill,g_center,w_${w},h_${h}`;
  const tall = aspect === "9:16";

  // 1. Title card as a 3 s video: the base every other segment is spliced onto.
  const titleId = await renderCard(
    imageUrl(
      [
        `e_zoompan:from_(zoom_1);to_(zoom_1);du_${IMAGE_SECONDS}`,
        frame,
        "e_blur:1200",
        "e_brightness:-55",
        `${text("VERIFIED IMPACT", 28, ",co_rgb:34d399")}/fl_layer_apply,g_north,y_${tall ? 180 : 70}`,
        `${text(project.name, tall ? 60 : 48, wrap)}/fl_layer_apply,g_center,y_-40`,
        `${text(project.location ?? "", 30, wrap)}/fl_layer_apply,g_center,y_${tall ? 90 : 70}`,
      ].join("/"),
      before.cloudinaryPublicId,
      "mp4"
    ),
    `${prefix}_title`,
    "video"
  );

  // 2. Before / after cards with dated labels.
  const label = (asset: MediaAsset, caption: string, id: string) =>
    renderCard(
      imageUrl(
        [frame, `${text(caption, 40, ",b_rgb:000000aa")}/fl_layer_apply,g_south,y_${tall ? 200 : 50}`].join("/"),
        asset.cloudinaryPublicId,
        "jpg"
      ),
      id
    );
  const beforeCard = await label(before, `BEFORE · ${fmtDate(before.capturedAt)}`, `${prefix}_before`);
  const afterCard = await label(after, `AFTER · ${fmtDate(after.capturedAt)}`, `${prefix}_after`);

  // 3. Measured-change card: the change mask overlaid on the after photo, metric burned in.
  let metricCard: string | null = null;
  if (metric?.maskPublicId) {
    metricCard = await renderCard(
      imageUrl(
        [
          "c_fill,g_center,w_1024,h_768",
          `l_${overlayId(metric.maskPublicId)},o_75/fl_layer_apply`,
          frame,
          `${text(metricLine(metric), tall ? 40 : 34, `,b_rgb:000000aa${wrap}`)}/fl_layer_apply,g_south,y_${tall ? 200 : 50}`,
          `${text("MEASURED FROM PIXELS", 26, ",co_rgb:34d399,b_rgb:000000aa")}/fl_layer_apply,g_north,y_${tall ? 180 : 50}`,
        ].join("/"),
        after.cloudinaryPublicId,
        "jpg"
      ),
      `${prefix}_metric`
    );
  }

  // 4. Outro: QR code to the public Verify page plus the trust summary.
  const qr = await QRCode.toDataURL(input.verifyUrl, { width: 600, margin: 2 });
  const qrId = (await uploadGenerated(qr, `${prefix}_qr`)).publicId;
  const outroCard = await renderCard(
    imageUrl(
      [
        frame,
        "e_blur:1500",
        "e_brightness:-65",
        `l_${overlayId(qrId)},w_${Math.round(Math.min(w, h) * 0.5)}/fl_layer_apply,g_center`,
        `${text("Scan to verify every number", 36, wrap)}/fl_layer_apply,g_south,y_${tall ? 220 : 40}`,
        `${text(input.trustLine, 30, `,co_rgb:34d399${wrap}`)}/fl_layer_apply,g_north,y_${tall ? 200 : 40}`,
      ].join("/"),
      after.cloudinaryPublicId,
      "jpg"
    ),
    `${prefix}_outro`
  );

  // 5. One URL: base + cross-faded splices.
  const imageSegment = (id: string, seconds = IMAGE_SECONDS) =>
    `${TRANSITION},l_${overlayId(id)}/du_${seconds}/${frame}/fl_layer_apply`;
  const clipSegment = (clip: MediaAsset) =>
    `${TRANSITION},l_video:${overlayId(clip.cloudinaryPublicId)},so_1,du_${CLIP_SECONDS}/${frame}/fl_layer_apply`;

  const transformation = [
    frame,
    imageSegment(beforeCard),
    imageSegment(afterCard),
    ...(metricCard ? [imageSegment(metricCard, 4)] : []),
    ...clips.map(clipSegment),
    imageSegment(outroCard, 4),
  ].join("/");

  const deliveryUrl = `https://res.cloudinary.com/${cloudName()}/video/upload/${transformation}/${titleId}.mp4`;

  // Kick off eager generation so the first viewer doesn't wait on the render.
  const base = publicBaseUrl();
  await cloudinary.uploader
    .explicit(titleId, {
      type: "upload",
      resource_type: "video",
      eager: [{ raw_transformation: transformation, format: "mp4" }],
      eager_async: true,
      ...(base && !/localhost|127\.0\.0\.1/.test(base) && { notification_url: `${base}/api/cloudinary/webhook` }),
    })
    .catch((err: any) => console.warn("[reel] eager generation request failed:", err?.message || err));

  return {
    deliveryUrl,
    transformation,
    cards: { titleId, beforeCard, afterCard, metricCard, outroCard, qrId },
  };
}
