/**
 * Cloudinary Inline Tagging & EXIF Metadata Extractor
 * Reads inline categorization, auto_tagging, and EXIF GPS from Cloudinary upload responses.
 */

export interface ExtractedAiTag {
  label: string;
  confidence: number;
  source: "cloudinary_google" | "cloudinary_rekognition" | "external_vision";
}

export interface ExtractedExifData {
  exifLat: number | null;
  exifLng: number | null;
  capturedAt: string | null;
}

/**
 * Parses GPS coordinates from EXIF strings (e.g. "3 deg 7' 11.64\" N")
 */
function parseGpsCoordinate(coordStr: any, ref?: string): number | null {
  if (typeof coordStr === "number") {
    let val = coordStr;
    if (ref === "S" || ref === "W") val = -val;
    return val;
  }

  if (typeof coordStr === "string") {
    // Try plain float first
    const floatVal = parseFloat(coordStr);
    if (!isNaN(floatVal) && !coordStr.includes("deg")) {
      return ref === "S" || ref === "W" ? -Math.abs(floatVal) : floatVal;
    }

    // Try parsing degrees minutes seconds (DMS) format: "12 deg 35' 35.88\" S"
    const match = coordStr.match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"?\s*([NSEW])?/i);
    if (match) {
      const deg = parseFloat(match[1]) || 0;
      const min = parseFloat(match[2]) || 0;
      const sec = parseFloat(match[3]) || 0;
      const direction = match[4] || ref || "N";
      let dec = deg + min / 60 + sec / 3600;
      if (direction === "S" || direction === "W") dec = -dec;
      return dec;
    }
  }

  return null;
}

/**
 * Extracts AI tags from Cloudinary info payload if available
 */
export function extractCloudinaryAiTags(info: any): ExtractedAiTag[] {
  if (!info) return [];

  const tags: ExtractedAiTag[] = [];

  // Google Auto Tagging add-on
  if (info.categorization?.google_tagging?.data) {
    for (const item of info.categorization.google_tagging.data) {
      if (item.tag) {
        tags.push({
          label: item.tag,
          confidence: Math.round((item.confidence || 0.9) * 100) / 100,
          source: "cloudinary_google",
        });
      }
    }
  }

  // AWS Rekognition add-on
  if (info.categorization?.aws_rek_tagging?.data) {
    for (const item of info.categorization.aws_rek_tagging.data) {
      if (item.tag) {
        tags.push({
          label: item.tag,
          confidence: Math.round((item.confidence || 0.9) * 100) / 100,
          source: "cloudinary_rekognition",
        });
      }
    }
  }

  // Generic auto_tagging array
  if (Array.isArray(info.auto_tagging)) {
    for (const item of info.auto_tagging) {
      if (item.tag) {
        tags.push({
          label: item.tag,
          confidence: Math.round((item.confidence || 0.9) * 100) / 100,
          source: "cloudinary_google",
        });
      }
    }
  }

  return tags;
}

/**
 * Extracts EXIF GPS & Date from Cloudinary image_metadata payload
 */
export function extractCloudinaryExif(metadata: any): ExtractedExifData {
  if (!metadata) {
    return { exifLat: null, exifLng: null, capturedAt: null };
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let capturedAt: string | null = null;

  if (metadata.GPSLatitude) {
    lat = parseGpsCoordinate(metadata.GPSLatitude, metadata.GPSLatitudeRef);
  }
  if (metadata.GPSLongitude) {
    lng = parseGpsCoordinate(metadata.GPSLongitude, metadata.GPSLongitudeRef);
  }

  // Capture timestamp
  const dateStr = metadata.DateTimeOriginal || metadata.CreateDate || metadata.ModifyDate;
  if (dateStr) {
    try {
      // EXIF date format is usually "YYYY:MM:DD HH:MM:SS"
      const formatted = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
      const d = new Date(formatted);
      if (!isNaN(d.getTime())) {
        capturedAt = d.toISOString();
      }
    } catch (e) {
      // ignore
    }
  }

  return { exifLat: lat, exifLng: lng, capturedAt };
}
