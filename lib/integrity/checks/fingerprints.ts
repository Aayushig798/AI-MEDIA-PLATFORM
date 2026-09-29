import { prisma as db } from "@/lib/db";
import { CHECK_LABELS, CheckResult, IntegrityContext, skipped } from "../types";

// Cloudinary pHash distance thresholds (64-bit hash).
const PHASH_STRONG = 6;
const PHASH_MATCH = 10;

/** Check 1: byte-identical copy (SHA-256 of the stored original, or Cloudinary etag/MD5). */
export async function checkDuplicate(ctx: IntegrityContext): Promise<CheckResult> {
  const { asset } = ctx;
  const or: { sha256?: string; etag?: string }[] = [];
  if (ctx.sha256) or.push({ sha256: ctx.sha256 });
  if (ctx.cloudinary?.etag) or.push({ etag: ctx.cloudinary.etag });
  if (or.length === 0) return skipped("duplicate", "No file fingerprint available for this asset.");

  const dups = await db.mediaAsset.findMany({
    where: { id: { not: asset.id }, OR: or },
    select: { id: true, projectId: true, createdAt: true, project: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const earlier = dups.filter((d) => d.createdAt < asset.createdAt);
  const details = {
    sha256: ctx.sha256,
    etag: ctx.cloudinary?.etag ?? null,
    matches: dups.map((d) => ({ assetId: d.id, projectId: d.projectId, projectName: d.project.name })),
  };

  if (earlier.length === 0) {
    return {
      id: "duplicate",
      label: CHECK_LABELS.duplicate,
      status: "pass",
      penalty: 0,
      confidence: "high",
      summary:
        dups.length > 0
          ? `This is the original; ${dups.length} later upload(s) are byte-identical copies of it.`
          : "No byte-identical copy exists anywhere in the library.",
      details,
    };
  }

  const first = earlier[0];
  const crossProject = first.projectId !== asset.projectId;
  return {
    id: "duplicate",
    label: CHECK_LABELS.duplicate,
    status: "fail",
    penalty: crossProject ? 60 : 30,
    confidence: "high",
    summary: crossProject
      ? `Byte-identical to a file already submitted for another project ("${first.project.name}").`
      : "Byte-identical to a file already uploaded to this project.",
    details,
  };
}

const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Bit distance between two equal-length hex hashes, one nibble at a time. */
function hammingHex(a: string, b: string): number | null {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return null;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    count += NIBBLE_BITS[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  }
  return count;
}

/** Check 2: visually the same photo (resized, recompressed, lightly cropped) reused elsewhere. */
export async function checkPhash(ctx: IntegrityContext): Promise<CheckResult> {
  const { asset } = ctx;
  const phash = ctx.cloudinary?.phash ?? asset.phash;
  if (!phash) {
    return skipped(
      "phash",
      asset.resourceType === "video"
        ? "Perceptual hashing applies to still images only."
        : "Cloudinary returned no perceptual hash for this asset."
    );
  }

  const candidates = await db.mediaAsset.findMany({
    where: { id: { not: asset.id }, phash: { not: null } },
    select: {
      id: true,
      projectId: true,
      phash: true,
      sha256: true,
      capturedAt: true,
      createdAt: true,
      secureUrl: true,
      project: { select: { name: true } },
    },
  });

  const matches = candidates
    .map((c) => ({ ...c, hamming: hammingHex(phash, c.phash!) }))
    .filter((c): c is typeof c & { hamming: number } => c.hamming !== null && c.hamming <= PHASH_MATCH)
    .sort((a, b) => a.hamming - b.hamming);

  await db.phashMatch.deleteMany({ where: { assetId: asset.id } });
  if (matches.length > 0) {
    await db.phashMatch.createMany({
      data: matches.map((m) => ({
        assetId: asset.id,
        matchAssetId: m.id,
        hamming: m.hamming,
        crossProject: m.projectId !== asset.projectId,
      })),
      skipDuplicates: true,
    });
  }

  const details = {
    phash,
    matches: matches.map((m) => ({
      assetId: m.id,
      projectId: m.projectId,
      projectName: m.project.name,
      hamming: m.hamming,
      similarity: Math.round((1 - m.hamming / 64) * 100),
      secureUrl: m.secureUrl,
      capturedAt: m.capturedAt,
    })),
  };

  // Only the later upload is suspicious; byte-identical copies are the duplicate check's job.
  const earlier = matches.filter((m) => m.createdAt < asset.createdAt && !(ctx.sha256 && m.sha256 === ctx.sha256));
  const cross = earlier.find((m) => m.projectId !== asset.projectId);
  if (cross) {
    const similarity = Math.round((1 - cross.hamming / 64) * 100);
    return {
      id: "phash",
      label: CHECK_LABELS.phash,
      status: "fail",
      penalty: 35,
      confidence: cross.hamming <= PHASH_STRONG ? "high" : "medium",
      summary: `Recycled: ${similarity}% perceptual match with a photo from another project ("${cross.project.name}").`,
      details,
    };
  }

  const claimed = asset.capturedAt?.getTime();
  const sameProjectOtherDate = earlier.find(
    (m) => claimed && m.capturedAt && Math.abs(m.capturedAt.getTime() - claimed) > 30 * 86_400_000
  );
  if (sameProjectOtherDate) {
    return {
      id: "phash",
      label: CHECK_LABELS.phash,
      status: "warn",
      penalty: 15,
      confidence: "medium",
      summary: "The same scene was already submitted for this project with a claimed date more than 30 days apart.",
      details,
    };
  }

  const identicalOnly = earlier.length === 0 && matches.some((m) => m.createdAt < asset.createdAt);
  return {
    id: "phash",
    label: CHECK_LABELS.phash,
    status: "pass",
    penalty: 0,
    confidence: "high",
    summary: identicalOnly
      ? "Only byte-identical copies match (scored by the duplicate check)."
      : earlier.length > 0
        ? "Near-identical only to same-day shots in this project (e.g. burst photos)."
        : "No visually similar photo exists in any other project.",
    details,
  };
}
