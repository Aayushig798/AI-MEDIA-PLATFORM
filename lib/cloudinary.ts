import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary server-side instance
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "demo",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
  secure: true,
});

export { cloudinary };

export interface CloudinarySignedParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  categorization: string;
  autoTagging: number;
  imageMetadata: boolean;
  phash: boolean;
  notificationUrl: string | null;
}

/**
 * Generate a signed upload signature for direct browser-to-Cloudinary upload.
 * Folder convention: impact-platform/{projectId}/{uuid}
 * Signed params include Google Auto Tagging add-on and EXIF metadata extraction.
 */
export function generateUploadSignature(projectId: string, folderUuid: string): CloudinarySignedParams {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "demo";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `impact-platform/${projectId}/${folderUuid}`;

  // Parameters to sign (must match form fields submitted to Cloudinary)
  const paramsToSign: Record<string, string | number | boolean> = {
    auto_tagging: 0.6,
    categorization: "google_tagging",
    folder,
    image_metadata: true,
    // Perceptual hash for the Integrity Engine's recycled-photo check
    phash: true,
    timestamp,
  };

  // Webhooks need a URL Cloudinary can reach, so skip them for plain localhost.
  const base = publicBaseUrl();
  const notificationUrl = base && !/localhost|127\.0\.0\.1/.test(base) ? `${base}/api/cloudinary/webhook` : null;
  if (notificationUrl) paramsToSign.notification_url = notificationUrl;

  let signature = "";
  if (apiSecret) {
    signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
  } else {
    // If running in development without credentials, provide a fallback hash
    signature = "dev_simulated_signature_" + timestamp;
  }

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    categorization: "google_tagging",
    autoTagging: 0.6,
    imageMetadata: true,
    phash: true,
    notificationUrl,
  };
}

export { getThumbnailUrl } from "./cloudinary-url";

/**
 * Delete asset from Cloudinary using Cloudinary destroy API.
 * Returns true if successful, throws error or returns false if failed.
 */
export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: string = "image"
): Promise<{ success: boolean; result?: string; message?: string }> {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // If no Cloudinary secret is set, handle gracefully for test/seed items
  if (!apiSecret || apiSecret.startsWith("mock_")) {
    console.warn(`[Cloudinary destroy] Mock mode active: simulated deletion of ${publicId}`);
    return { success: true, result: "ok (simulated)" };
  }

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType === "video" ? "video" : "image",
      invalidate: true,
    });

    if (res.result === "ok" || res.result === "not found") {
      return { success: true, result: res.result };
    }

    throw new Error(`Cloudinary destroy returned: ${res.result}`);
  } catch (error: any) {
    console.error("Cloudinary destruction error:", error);
    throw new Error(`Failed to delete asset from Cloudinary: ${error.message || error}`);
  }
}

// ---------------------------------------------------------------------------
// Integrity Engine helpers
// ---------------------------------------------------------------------------

export function isCloudinaryConfigured(): boolean {
  const secret = process.env.CLOUDINARY_API_SECRET;
  return !!(process.env.CLOUDINARY_API_KEY && secret && !secret.startsWith("mock_"));
}

/** Public base URL of this app, used for webhooks and QR codes. */
export function publicBaseUrl(): string | null {
  const url = process.env.PUBLIC_BASE_URL || process.env.NEXTAUTH_URL;
  return url ? url.replace(/\/$/, "") : null;
}

/** Cloudinary drops leading zeros from the 64-bit hash; restore the full 16 hex chars. */
export function normalizePhash(value: unknown): string | null {
  if (typeof value !== "string" || !/^[0-9a-f]{1,16}$/i.test(value)) return null;
  return value.toLowerCase().padStart(16, "0");
}

export interface ResourceFacts {
  phash: string | null;
  etag: string | null;
  metadata: Record<string, unknown> | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
}

/**
 * Admin API resource details, including the perceptual hash and embedded
 * image metadata. Returns null when the asset isn't on this Cloudinary account.
 */
export async function getResourceFacts(publicId: string, resourceType: string): Promise<ResourceFacts | null> {
  if (!isCloudinaryConfigured()) return null;
  try {
    const res = await cloudinary.api.resource(publicId, {
      resource_type: resourceType === "video" ? "video" : "image",
      phash: resourceType !== "video",
      media_metadata: true,
    });
    return {
      phash: normalizePhash(res.phash),
      etag: typeof res.etag === "string" ? res.etag : null,
      metadata: (res.image_metadata as Record<string, unknown>) ?? null,
      bytes: res.bytes ?? null,
      width: res.width ?? null,
      height: res.height ?? null,
    };
  } catch (error: any) {
    const status = error?.error?.http_code ?? error?.http_code;
    if (status === 404) return null;
    throw new Error(`Cloudinary Admin API: ${error?.error?.message || error?.message || error}`);
  }
}

/** Server-side upload of generated media (change masks, QR codes, report images). */
export async function uploadGenerated(
  dataUri: string,
  publicId: string,
  resourceType: "image" | "video" = "image"
): Promise<{ publicId: string; secureUrl: string; width: number; height: number }> {
  const res = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    resource_type: resourceType,
    overwrite: true,
    invalidate: true,
  });
  return { publicId: res.public_id, secureUrl: res.secure_url, width: res.width, height: res.height };
}

/**
 * Signed delivery URL for the untouched original. The s--signature-- component
 * proves the path (and therefore the absence of transformations) wasn't altered.
 */
export function signedOriginalUrl(publicId: string, resourceType: string, format?: string): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType === "video" ? "video" : "image",
    type: "upload",
    sign_url: true,
    secure: true,
    ...(format && { format }),
  });
}
