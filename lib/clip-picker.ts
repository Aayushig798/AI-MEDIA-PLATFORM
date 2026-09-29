import type { MediaAsset, Project } from "@prisma/client";
import { cloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { withTransformation } from "@/lib/cloudinary-url";
import { buildClaimQuestions } from "@/lib/integrity/checks/vision";

const MAX_FRAMES = 6;
const DEFAULT_START = 1;

export interface ClipPick {
  start: number;
  reason: string;
}

async function isYes(uri: string, question: string): Promise<boolean> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const auth = Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64");
  const res = await fetch(`https://api.cloudinary.com/v2/analysis/${cloud}/analyze/ai_vision_moderation`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ source: { uri }, rejection_questions: [question] }),
  });
  if (!res.ok) throw new Error(`AI Vision HTTP ${res.status}`);
  const json = await res.json();
  return String(json?.data?.analysis?.responses?.[0]?.value ?? "").toLowerCase().startsWith("yes");
}

/**
 * AI-driven clip selection: sample frames across a field video and pick the
 * first moment Cloudinary AI Vision says shows the claimed work. Falls back to
 * the opening seconds when AI Vision isn't available.
 */
export async function pickClipStart(
  clip: MediaAsset,
  project: Pick<Project, "claim">,
  clipSeconds: number
): Promise<ClipPick> {
  if (!isCloudinaryConfigured()) return { start: DEFAULT_START, reason: "default (Cloudinary not configured)" };
  try {
    const resource = await cloudinary.api.resource(clip.cloudinaryPublicId, { resource_type: "video" });
    const duration = Number(resource.duration) || 0;
    if (duration <= clipSeconds + 1) return { start: 0, reason: "whole clip (short video)" };

    const question =
      buildClaimQuestions(clip.claimText || project.claim || clip.manualNotes, clip.manualCategory)[0] ??
      "Does this frame show field work, construction, planting or water?";
    const lastStart = duration - clipSeconds;
    const step = Math.max(1, lastStart / MAX_FRAMES);
    const times = Array.from({ length: MAX_FRAMES }, (_, i) => Math.round(i * step * 10) / 10).filter((t) => t <= lastStart);

    const answers = await Promise.all(
      times.map((t) => isYes(withTransformation(clip.secureUrl, `so_${t},w_640,c_limit`, "jpg"), question).catch(() => null))
    );
    if (answers.every((a) => a === null)) return { start: DEFAULT_START, reason: "default (AI Vision unavailable)" };

    const hit = answers.findIndex((a) => a === true);
    if (hit === -1) return { start: DEFAULT_START, reason: "default (no frame matched the claim)" };
    return { start: times[hit], reason: `AI Vision: "${question}" → yes at ${times[hit]}s` };
  } catch (err: any) {
    console.warn("[clip-picker] falling back to default start:", err?.message || err);
    return { start: DEFAULT_START, reason: "default (analysis failed)" };
  }
}
