import type { MediaAsset, Project } from "@prisma/client";
import type { VisionResult } from "./checks/vision";

export type CheckId =
  | "duplicate"
  | "phash"
  | "web"
  | "exif"
  | "location"
  | "weather"
  | "satellite"
  | "claim"
  | "provenance";

export type CheckStatus = "pass" | "warn" | "fail" | "skipped" | "error";
export type Confidence = "high" | "medium" | "low";

export interface CheckResult {
  id: CheckId;
  label: string;
  status: CheckStatus;
  /** Points deducted from 100. 0 for pass/skipped/error. */
  penalty: number;
  confidence: Confidence;
  /** One plain-language sentence a reviewer can act on. */
  summary: string;
  details?: Record<string, unknown>;
}

export interface CloudinaryFacts {
  phash: string | null;
  etag: string | null;
  metadata: Record<string, unknown> | null;
}

export interface IntegrityContext {
  asset: MediaAsset & { project: Project };
  /** URL of a still image to analyse (the photo itself, or a video frame). */
  analysisImageUrl: string;
  cloudinary: CloudinaryFacts | null;
  sha256: string | null;
  exif: Record<string, unknown> | null;
  gps: { lat: number; lng: number } | null;
  /** EXIF capture time when present, else the uploader's claimed capture date. */
  takenAt: Date | null;
  takenAtSource: "exif" | "claimed" | null;
  /** Where to evaluate weather/satellite: photo GPS first, then project centre. */
  site: { lat: number; lng: number; source: "exif" | "project" } | null;
  vision: VisionResult | null;
  visionError: string | null;
}

export const CHECK_LABELS: Record<CheckId, string> = {
  duplicate: "Exact duplicate",
  phash: "Recycled image (perceptual hash)",
  web: "Found on the internet",
  exif: "EXIF consistency",
  location: "Inside project geofence",
  weather: "Weather plausibility",
  satellite: "Satellite plausibility",
  claim: "Shows what the claim says (AI auditor)",
  provenance: "AI-generated / edited signals",
};

export function skipped(id: CheckId, summary: string, details?: Record<string, unknown>): CheckResult {
  return { id, label: CHECK_LABELS[id], status: "skipped", penalty: 0, confidence: "low", summary, details };
}

export function errored(id: CheckId, err: unknown): CheckResult {
  const message = err instanceof Error ? err.message : String(err);
  return { id, label: CHECK_LABELS[id], status: "error", penalty: 0, confidence: "low", summary: `Check could not run: ${message}` };
}
