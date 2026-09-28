/**
 * Client-safe Cloudinary URL helpers and transformations.
 * Contains no Node.js built-ins (fs, crypto, etc.) so it can be safely used in client components.
 */

/**
 * Generate a gallery thumbnail URL using Cloudinary transformations
 * Transformation: c_thumb,w_300,h_300,g_auto
 */
export function getThumbnailUrl(
  secureUrl: string,
  resourceType: string = "image"
): string {
  if (!secureUrl) return "";

  // If it's a Cloudinary URL, inject the transformation
  if (secureUrl.includes("res.cloudinary.com")) {
    const uploadIdx = secureUrl.indexOf("/upload/");
    if (uploadIdx !== -1) {
      const prefix = secureUrl.slice(0, uploadIdx + "/upload/".length);
      const suffix = secureUrl.slice(uploadIdx + "/upload/".length);

      // If it's a video, generate image poster frame with format jpg
      if (resourceType === "video") {
        const jpgSuffix = suffix.replace(/\.[^/.]+$/, ".jpg");
        return `${prefix}c_thumb,w_300,h_300,g_auto/${jpgSuffix}`;
      }

      return `${prefix}c_thumb,w_300,h_300,g_auto/${suffix}`;
    }
  }

  // If it's an Unsplash fallback image URL
  if (secureUrl.includes("images.unsplash.com")) {
    return secureUrl.replace(/w=\d+/, "w=300").replace(/h=\d+/, "h=300");
  }

  return secureUrl;
}

/**
 * Normalizes a Cloudinary image URL with matched crop and aspect ratio
 * so before & after images fit perfectly in the comparison slider.
 */
export function getNormalizedComparisonUrl(
  secureUrl: string,
  width = 800,
  height = 600
): string {
  if (!secureUrl || !secureUrl.includes("cloudinary.com")) {
    return secureUrl;
  }
  const uploadToken = "/image/upload/";
  const idx = secureUrl.indexOf(uploadToken);
  if (idx === -1) return secureUrl;

  const prefix = secureUrl.substring(0, idx + uploadToken.length);
  const suffix = secureUrl.substring(idx + uploadToken.length);

  // If already transformed with c_, return with standard dimensions
  if (suffix.startsWith("c_") || suffix.startsWith("v")) {
    return `${prefix}c_fill,w_${width},h_${height},g_auto/${suffix.replace(/^c_[^/]+\//, "")}`;
  }

  return `${prefix}c_fill,w_${width},h_${height},g_auto/${suffix}`;
}

/**
 * Downscales an image URL to w_512 for fast, cost-effective OpenAI GPT-4o-mini vision verification.
 */
export function getOptimizedVisionUrl(secureUrl: string, width = 512): string {
  if (!secureUrl) return "";
  if (secureUrl.includes("cloudinary.com")) {
    const uploadToken = "/upload/";
    const idx = secureUrl.indexOf(uploadToken);
    if (idx !== -1) {
      const prefix = secureUrl.substring(0, idx + uploadToken.length);
      const suffix = secureUrl.substring(idx + uploadToken.length);
      return `${prefix}c_limit,w_${width},q_auto,f_auto/${suffix.replace(/^c_[^/]+\//, "")}`;
    }
  }
  if (secureUrl.includes("images.unsplash.com")) {
    return secureUrl.replace(/w=\d+/, `w=${width}`);
  }
  return secureUrl;
}


