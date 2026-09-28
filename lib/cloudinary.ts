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
  const paramsToSign = {
    auto_tagging: 0.6,
    categorization: "google_tagging",
    folder,
    image_metadata: true,
    timestamp,
  };

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
