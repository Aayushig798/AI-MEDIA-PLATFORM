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
