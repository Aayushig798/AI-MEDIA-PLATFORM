import { haversineMeters } from "@/lib/geo";
import { CHECK_LABELS, CheckResult, IntegrityContext, skipped } from "../types";

const EDITING_SOFTWARE = /photoshop|lightroom|gimp|snapseed|picsart|canva|facetune|pixlr|affinity|luminar|remini/i;
const DAY = 86_400_000;

/** Check 4: EXIF internal consistency. Absent EXIF is a weak signal (WhatsApp strips it). */
export function checkExif(ctx: IntegrityContext): CheckResult {
  const { asset, exif } = ctx;
  if (asset.resourceType !== "image") return skipped("exif", "EXIF checks apply to still images only.");

  if (!exif || Object.keys(exif).length === 0) {
    return {
      id: "exif",
      label: CHECK_LABELS.exif,
      status: "warn",
      penalty: 5,
      confidence: "low",
      summary: "No camera metadata. Messaging apps strip EXIF, so this is only a weak signal.",
    };
  }

  const software = typeof exif.Software === "string" ? exif.Software : null;
  const original = exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : null;
  const details = {
    make: exif.Make ?? null,
    model: exif.Model ?? null,
    software,
    dateTimeOriginal: original?.toISOString() ?? null,
    hasGps: !!ctx.gps,
  };

  const problems: { penalty: number; text: string; confidence: "high" | "medium" | "low" }[] = [];

  if (software && EDITING_SOFTWARE.test(software)) {
    problems.push({ penalty: 10, confidence: "medium", text: `Saved by editing software (${software}).` });
  }
  if (original) {
    if (original.getTime() > asset.createdAt.getTime() + DAY) {
      problems.push({ penalty: 15, confidence: "high", text: "Camera timestamp is after the upload time." });
    }
    if (asset.capturedAt && Math.abs(original.getTime() - asset.capturedAt.getTime()) > 3 * DAY) {
      const days = Math.round(Math.abs(original.getTime() - asset.capturedAt.getTime()) / DAY);
      problems.push({
        penalty: 10,
        confidence: "medium",
        text: `Camera says it was taken ${days} days away from the claimed capture date.`,
      });
    }
    if (asset.createdAt.getTime() - original.getTime() > 365 * DAY) {
      problems.push({ penalty: 5, confidence: "low", text: "Photo is more than a year older than its upload." });
    }
  }

  if (problems.length === 0) {
    return {
      id: "exif",
      label: CHECK_LABELS.exif,
      status: "pass",
      penalty: 0,
      confidence: "medium",
      summary: [details.make, details.model].filter(Boolean).join(" ")
        ? `Consistent camera metadata (${[details.make, details.model].filter(Boolean).join(" ")}${original ? `, taken ${original.toISOString().slice(0, 10)}` : ""}).`
        : "Camera metadata present and consistent.",
      details,
    };
  }

  const penalty = problems.reduce((s, p) => s + p.penalty, 0);
  return {
    id: "exif",
    label: CHECK_LABELS.exif,
    status: penalty >= 15 ? "fail" : "warn",
    penalty,
    confidence: problems.some((p) => p.confidence === "high") ? "high" : "medium",
    summary: problems.map((p) => p.text).join(" "),
    details,
  };
}

/** GPS in the photo vs the project's declared site. */
export function checkLocation(ctx: IntegrityContext): CheckResult {
  const { project } = ctx.asset;
  if (!ctx.gps) return skipped("location", "Photo has no GPS coordinates.");
  if (project.latitude == null || project.longitude == null) {
    return skipped("location", "Project has no site coordinates to compare against.", { gps: ctx.gps });
  }

  const distance = haversineMeters(ctx.gps, { lat: project.latitude, lng: project.longitude });
  const radius = project.geofenceRadiusM;
  const details = {
    gps: ctx.gps,
    site: { lat: project.latitude, lng: project.longitude },
    distanceM: Math.round(distance),
    radiusM: radius,
  };
  const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

  if (distance <= radius) {
    return {
      id: "location",
      label: CHECK_LABELS.location,
      status: "pass",
      penalty: 0,
      confidence: "high",
      summary: `GPS is ${km(distance)} from the project site, inside the ${km(radius)} geofence.`,
      details,
    };
  }
  return {
    id: "location",
    label: CHECK_LABELS.location,
    status: "fail",
    penalty: distance > radius * 10 ? 25 : 15,
    confidence: "high",
    summary: `GPS is ${km(distance)} from the project site, outside the ${km(radius)} geofence.`,
    details,
  };
}
