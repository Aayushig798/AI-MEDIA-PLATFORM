import type { MediaAsset } from "@prisma/client";
import { db } from "@/lib/db";
import { classifyTransformation, withTransformation } from "@/lib/cloudinary-url";
import { tryAppendLedger } from "@/lib/ledger";

/** Content Credentials (C2PA) signing is a request-only Cloudinary beta. */
export function c2paEnabled(): boolean {
  return process.env.CLOUDINARY_C2PA_ENABLED === "true";
}

/**
 * Record a delivery URL derived from an original, classified with Cloudinary's
 * transcoded/edited vocabulary, and log it to the ledger the first time it is issued.
 */
export async function registerDerivative(
  asset: Pick<MediaAsset, "id" | "projectId" | "secureUrl" | "resourceType">,
  transformation: string,
  purpose: string,
  actor: string,
  extension?: string
) {
  const cls = classifyTransformation(transformation);
  // Signed Content Credentials only apply to images.
  const full =
    c2paEnabled() && asset.resourceType === "image" ? `${transformation}/fl_c2pa` : transformation;
  const url = withTransformation(asset.secureUrl, full, extension);

  const existing = await db.derivedAsset.findUnique({ where: { url } });
  if (existing) return existing;

  const derived = await db.derivedAsset.create({
    data: { assetId: asset.id, transformation: full, url, class: cls, purpose },
  });
  await tryAppendLedger({
    type: "DERIVATIVE_ISSUED",
    actor,
    assetId: asset.id,
    projectId: asset.projectId,
    payload: { url, transformation: full, class: cls, purpose },
  });
  return derived;
}
