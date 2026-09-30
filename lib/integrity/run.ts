import { createHash } from "crypto";
import exifr from "exifr";
import type { Prisma } from "@prisma/client";
import { prisma as db } from "@/lib/db";
import { getResourceFacts } from "@/lib/cloudinary";
import { getAnalysisImageUrl, EVIDENCE_TRANSFORMATION } from "@/lib/cloudinary-url";
import { registerDerivative } from "@/lib/derivatives";
import { appendLedger } from "@/lib/ledger";
import { canonicalJSON, sha256Hex } from "@/lib/ledger-core";
import { CHECK_LABELS, CheckResult, IntegrityContext, errored } from "./types";
import { checkDuplicate, checkPhash } from "./checks/fingerprints";
import { checkExif, checkLocation } from "./checks/exif";
import { checkWeb } from "./checks/web";
import { checkWeather } from "./checks/weather";
import { checkSatellite } from "./checks/satellite";
import { runVision, checkClaim, checkProvenance } from "./checks/vision";
import { scoreChecks } from "./score";

const MAX_HASH_BYTES = 60 * 1024 * 1024;

/** JSON-safe copy of exifr output (Dates -> ISO strings, binary blobs dropped). */
function sanitizeExif(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v instanceof Date) out[k] = isNaN(v.getTime()) ? null : v.toISOString();
    else if (v instanceof Uint8Array || ArrayBuffer.isView(v)) continue;
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v) && v.length <= 16 && v.every((x) => typeof x === "number" || typeof x === "string")) out[k] = v;
  }
  return out;
}

/** "2024:05:18 10:22:11" (EXIF) -> Date */
function parseExifDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  return isNaN(d.getTime()) ? null : d;
}

/** Exiftool-style `41 deg 51' 10.80" N` -> 41.853 (negative for S/W). */
function parseDms(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.match(/(\d+(?:\.\d+)?)\s*deg\s*(\d+(?:\.\d+)?)'\s*(\d+(?:\.\d+)?)"?\s*([NSEW])?/i);
  if (!m) return null;
  const deg = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return /[SW]/i.test(m[4] ?? "") ? -deg : deg;
}

async function buildContext(assetId: string): Promise<IntegrityContext> {
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: assetId }, include: { project: true } });

  const facts = await getResourceFacts(asset.cloudinaryPublicId, asset.resourceType).catch((err) => {
    console.warn(`[integrity] resource facts unavailable for ${asset.id}:`, err.message);
    return null;
  });

  // Hash and parse the stored original (the untransformed delivery URL serves it byte-for-byte).
  let sha256: string | null = null;
  let exif: Record<string, unknown> | null = null;
  if (/^https?:\/\//.test(asset.secureUrl) && (asset.bytes || 0) <= MAX_HASH_BYTES) {
    try {
      const res = await fetch(asset.secureUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        sha256 = createHash("sha256").update(buffer).digest("hex");
        if (asset.resourceType === "image") {
          const parsed = await exifr.parse(buffer, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false }).catch(() => null);
          if (parsed && Object.keys(parsed).length > 0) exif = parsed;
        }
      }
    } catch (err: any) {
      console.warn(`[integrity] could not fetch original for ${asset.id}:`, err.message);
    }
  }
  // Fall back to the metadata Cloudinary extracted, if we couldn't parse it ourselves.
  if (!exif && facts?.metadata && Object.keys(facts.metadata).length > 0) {
    exif = {
      ...facts.metadata,
      DateTimeOriginal: parseExifDate(facts.metadata.DateTimeOriginal) ?? undefined,
      latitude: parseDms(facts.metadata.GPSLatitude) ?? undefined,
      longitude: parseDms(facts.metadata.GPSLongitude) ?? undefined,
    };
  }

  const lat = Number(exif?.latitude);
  const lng = Number(exif?.longitude);
  const gps = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng } : null;

  const exifTaken = parseExifDate(exif?.DateTimeOriginal ?? exif?.CreateDate);
  const takenAt = exifTaken ?? asset.capturedAt ?? null;

  const site = gps
    ? { ...gps, source: "exif" as const }
    : asset.project.latitude != null && asset.project.longitude != null
      ? { lat: asset.project.latitude, lng: asset.project.longitude, source: "project" as const }
      : null;

  return {
    asset,
    analysisImageUrl: getAnalysisImageUrl(asset.secureUrl, asset.resourceType),
    cloudinary: facts ? { phash: facts.phash, etag: facts.etag, metadata: facts.metadata } : null,
    sha256,
    exif,
    gps,
    takenAt,
    takenAtSource: exifTaken ? "exif" : takenAt ? "claimed" : null,
    site,
    vision: null,
    visionError: null,
  };
}

async function settle(id: CheckResult["id"], fn: () => Promise<CheckResult> | CheckResult): Promise<CheckResult> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[integrity] check ${id} failed:`, err);
    return errored(id, err);
  }
}

export async function runIntegrity(assetId: string, actor: string) {
  await db.assetIntegrity.upsert({
    where: { assetId },
    create: { assetId, status: "RUNNING" },
    update: { status: "RUNNING", error: null },
  });

  try {
    const ctx = await buildContext(assetId);

    await db.mediaAsset.update({
      where: { id: assetId },
      data: {
        sha256: ctx.sha256 ?? undefined,
        etag: ctx.cloudinary?.etag ?? undefined,
        phash: ctx.cloudinary?.phash ?? undefined,
      },
    });

    // Stage 1: independent checks, including the AI Vision call later checks depend on.
    const [duplicate, phash, web] = await Promise.all([
      settle("duplicate", () => checkDuplicate(ctx)),
      settle("phash", () => checkPhash(ctx)),
      settle("web", () => checkWeb(ctx)),
      runVision(ctx)
        .then((v) => {
          ctx.vision = v;
        })
        .catch((err) => {
          console.error("[integrity] AI Vision failed:", err);
          ctx.visionError = err instanceof Error ? err.message : String(err);
        }),
    ]);
    const exif = await settle("exif", () => checkExif(ctx));
    const location = await settle("location", () => checkLocation(ctx));

    // Stage 2: checks that need the photo's visual cues or location.
    const [weather, satellite, claim, provenance] = await Promise.all([
      settle("weather", () => checkWeather(ctx)),
      settle("satellite", () => checkSatellite(ctx)),
      settle("claim", () => checkClaim(ctx)),
      settle("provenance", () => checkProvenance(ctx)),
    ]);

    const checks: CheckResult[] = [duplicate, phash, web, exif, location, weather, satellite, claim, provenance];
    const { trustScore, verdict, evidenceChecks, capped } = scoreChecks(checks);
    if (capped) {
      checks.push({
        id: "coverage",
        label: CHECK_LABELS.coverage,
        status: "warn",
        penalty: 0,
        confidence: "high",
        summary: `Only ${evidenceChecks} check${evidenceChecks === 1 ? "" : "s"} could run on this asset, too few to verify it automatically; a reviewer should confirm it.`,
      });
    }
    const checksJson = JSON.parse(JSON.stringify(checks)) as Prisma.InputJsonValue;

    const integrity = await db.assetIntegrity.update({
      where: { assetId },
      data: {
        status: "DONE",
        trustScore,
        verdict,
        checks: checksJson,
        exif: ctx.exif ? (sanitizeExif(ctx.exif) as Prisma.InputJsonValue) : undefined,
        gpsLat: ctx.gps?.lat ?? null,
        gpsLng: ctx.gps?.lng ?? null,
        takenAt: ctx.takenAt,
        computedAt: new Date(),
        error: null,
        // A new run supersedes any earlier human decision (which stays in the ledger).
        reviewDecision: null,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    // Evidence-grade derivative for the Verify page and reports.
    await registerDerivative(ctx.asset, EVIDENCE_TRANSFORMATION, "verify-page evidence", actor);

    await appendLedger({
      type: "INTEGRITY_CHECKED",
      actor,
      assetId,
      projectId: ctx.asset.projectId,
      payload: {
        trustScore,
        verdict,
        sha256: ctx.sha256,
        phash: ctx.cloudinary?.phash ?? ctx.asset.phash,
        // Digest of the full stored results, so the details can't be edited later unnoticed.
        checksDigest: await sha256Hex(canonicalJSON(checksJson)),
        checks: checks.map((c) => ({ id: c.id, status: c.status, penalty: c.penalty })),
      },
    });

    return integrity;
  } catch (err: any) {
    console.error(`[integrity] run failed for ${assetId}:`, err);
    return db.assetIntegrity.update({
      where: { assetId },
      data: { status: "ERROR", error: err?.message || String(err) },
    });
  }
}
