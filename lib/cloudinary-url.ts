/**
 * Client-safe Cloudinary URL helpers and transformations.
 * Contains no Node.js built-ins (fs, crypto, etc.) so it can be safely used in client components.
 */

/**
 * Insert a transformation into a Cloudinary delivery URL (right after /upload/),
 * optionally swapping the file extension (e.g. video -> .jpg poster frame).
 * Non-Cloudinary URLs are returned unchanged.
 */
export function withTransformation(secureUrl: string, transformation: string, extension?: string): string {
  if (!secureUrl || !secureUrl.includes("res.cloudinary.com")) return secureUrl;
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;

  const prefix = secureUrl.slice(0, idx + marker.length);
  let suffix = secureUrl.slice(idx + marker.length);
  if (extension) suffix = suffix.replace(/\.[^/.]+$/, "") + "." + extension;
  return transformation ? `${prefix}${transformation}/${suffix}` : `${prefix}${suffix}`;
}

/**
 * Generate a gallery thumbnail URL using Cloudinary transformations
 * Transformation: c_thumb,w_300,h_300,g_auto
 */
export function getThumbnailUrl(
  secureUrl: string,
  resourceType: string = "image"
): string {
  if (!secureUrl) return "";

  if (secureUrl.includes("res.cloudinary.com")) {
    // Videos get a JPG poster frame
    return withTransformation(secureUrl, "c_thumb,w_300,h_300,g_auto", resourceType === "video" ? "jpg" : undefined);
  }

  // If it's an Unsplash fallback image URL
  if (secureUrl.includes("images.unsplash.com")) {
    return secureUrl.replace(/w=\d+/, "w=300").replace(/h=\d+/, "h=300");
  }

  return secureUrl;
}

/** A still image to analyse: the photo itself, or a frame 1s into a video. */
export function getAnalysisImageUrl(secureUrl: string, resourceType: string): string {
  if (resourceType === "video") return withTransformation(secureUrl, "so_1,w_1280,c_limit", "jpg");
  return withTransformation(secureUrl, "w_1600,c_limit");
}

/**
 * Evidence-grade derivative: format/quality/fit only, so it stays "transcoded"
 * in Cloudinary's Content Credentials vocabulary.
 */
export const EVIDENCE_TRANSFORMATION = "c_fit,w_1600/f_auto,q_auto";

// Cloudinary's C2PA model: these alterations are "transcoded" (no change to what
// the image depicts). Anything else is "edited".
const TRANSCODED_CROPS = new Set(["fit", "mfit", "pad", "lpad", "mpad"]);
const NEUTRAL_KEYS = new Set(["f", "q", "dpr", "b"]);
const NEUTRAL_FLAGS = new Set(["c2pa", "progressive", "attachment", "lossy", "preserve_transparency"]);

export type DerivationClass = "TRANSCODED" | "EDITED";

export function classifyTransformation(transformation: string): DerivationClass {
  if (!transformation) return "TRANSCODED";

  for (const component of transformation.split("/")) {
    const params = component.split(",").filter(Boolean);
    let crop: string | null = null;
    let dims = 0;

    for (const p of params) {
      const sep = p.indexOf("_");
      const key = sep === -1 ? p : p.slice(0, sep);
      const value = sep === -1 ? "" : p.slice(sep + 1);

      if (key === "c") crop = value;
      else if (key === "w" || key === "h") dims++;
      else if (key === "fl") {
        if (!value.split(".").every((f) => NEUTRAL_FLAGS.has(f))) return "EDITED";
      } else if (!NEUTRAL_KEYS.has(key)) return "EDITED";
    }

    if (crop === null) {
      // Bare w_/h_ means c_scale; only single-dimension scaling keeps the aspect ratio.
      if (dims > 1) return "EDITED";
    } else if (crop === "scale") {
      if (dims > 1) return "EDITED";
    } else if (!TRANSCODED_CROPS.has(crop)) {
      return "EDITED";
    }
  }
  return "TRANSCODED";
}

/**
 * Escape text for an l_text: overlay. Cloudinary needs commas, slashes and
 * percent signs double-encoded; double-encoding the whole string is the
 * documented safe option and also covers non-ASCII (e.g. Hindi) text.
 */
export function encodeOverlayText(text: string): string {
  return encodeURIComponent(encodeURIComponent(text));
}

/** Public ID as used inside l_ overlays: folders are separated by colons. */
export function overlayId(publicId: string): string {
  return publicId.replace(/\//g, ":");
}
