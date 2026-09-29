/**
 * Client & Server EXIF Metadata Extractor
 * Safely extracts DateTimeOriginal / CreateDate from image files without external dependencies.
 */

/**
 * Parses raw EXIF date string (e.g. "2026:09:29 14:30:00" or "2026-09-29 14:30:00")
 * into a standard ISO string or formatted date.
 */
export function parseExifDateString(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim().replace(/\0/g, "");
  if (!trimmed) return null;

  // Typical EXIF format: "YYYY:MM:DD HH:MM:SS" or "YYYY:MM:DD"
  const match = trimmed.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  const year = match[1];
  const month = match[2];
  const day = match[3];
  const hour = match[4] || "00";
  const min = match[5] || "00";
  const sec = match[6] || "00";

  const iso = `${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  return d.toISOString();
}

/**
 * Extracts the real capture date from a File's binary EXIF data (DateTimeOriginal)
 * Reads the first 128 KB which contains all EXIF headers.
 */
export async function extractExifCaptureDate(file: File): Promise<string | null> {
  try {
    // Only attempt on images
    if (!file.type.startsWith("image/") && !/\.(jpe?g|tiff?|heic|png|webp)$/i.test(file.name)) {
      return null;
    }

    // Read the first 128 KB
    const blobSlice = file.slice(0, 131072);
    const buffer = await blobSlice.arrayBuffer();
    const view = new DataView(buffer);

    // Verify JPEG SOI marker (0xFFD8)
    if (view.byteLength < 4) return null;

    let offset = 0;
    if (view.getUint16(offset, false) === 0xffd8) {
      offset += 2;

      // Scan through JPEG markers until APP1 (0xFFE1)
      while (offset < view.byteLength - 4) {
        const marker = view.getUint16(offset, false);
        offset += 2;

        if (marker === 0xffe1) {
          // APP1 Marker found
          const app1Length = view.getUint16(offset, false);
          offset += 2;

          // Check for "Exif\0\0" (0x457869660000)
          if (
            view.getUint32(offset, false) === 0x45786966 &&
            view.getUint16(offset + 4, false) === 0x0000
          ) {
            const tiffStart = offset + 6;
            return parseTiffExifDate(view, tiffStart);
          }
          offset += app1Length - 2;
        } else if ((marker & 0xff00) === 0xff00) {
          // Other marker (SOF, DHT, DQT, APP0, etc.)
          const length = view.getUint16(offset, false);
          offset += length;
        } else {
          break;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn("[EXIF Parser] Failed to parse EXIF date from file:", err);
    return null;
  }
}

/**
 * Helper to parse TIFF IFD tags for DateTimeOriginal (0x9003), DateTimeDigitized (0x9004), or DateTime (0x0132)
 */
function parseTiffExifDate(view: DataView, tiffStart: number): string | null {
  if (tiffStart + 8 > view.byteLength) return null;

  // Endianness
  const endianMarker = view.getUint16(tiffStart, false);
  let littleEndian = false;
  if (endianMarker === 0x4949) {
    littleEndian = true; // "II" Intel
  } else if (endianMarker === 0x4d4d) {
    littleEndian = false; // "MM" Motorola
  } else {
    return null;
  }

  // 42 test
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) {
    return null;
  }

  // Offset to IFD0
  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  if (tiffStart + firstIfdOffset >= view.byteLength) return null;

  let ifdOffset = tiffStart + firstIfdOffset;
  const numEntries = view.getUint16(ifdOffset, littleEndian);
  ifdOffset += 2;

  let exifIfdOffset: number | null = null;
  let dateTimeStr: string | null = null;

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);

    // Tag 0x8769: Exif IFD Pointer
    if (tag === 0x8769) {
      exifIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
    }

    // Tag 0x0132: DateTime
    if (tag === 0x0132 && !dateTimeStr) {
      const valOffset = view.getUint32(entryOffset + 8, littleEndian);
      dateTimeStr = readAsciiString(view, tiffStart + valOffset, 20);
    }
  }

  // If Exif IFD found, search for DateTimeOriginal (0x9003) or DateTimeDigitized (0x9004)
  if (exifIfdOffset !== null && tiffStart + exifIfdOffset < view.byteLength - 2) {
    const subIfdOffset = tiffStart + exifIfdOffset;
    const subEntries = view.getUint16(subIfdOffset, littleEndian);
    let subEntryPos = subIfdOffset + 2;

    for (let j = 0; j < subEntries; j++) {
      const entryOffset = subEntryPos + j * 12;
      if (entryOffset + 12 > view.byteLength) break;

      const tag = view.getUint16(entryOffset, littleEndian);

      // Tag 0x9003: DateTimeOriginal (Preferred!)
      if (tag === 0x9003) {
        const valOffset = view.getUint32(entryOffset + 8, littleEndian);
        const originalDate = readAsciiString(view, tiffStart + valOffset, 20);
        if (originalDate) {
          const parsed = parseExifDateString(originalDate);
          if (parsed) return parsed;
        }
      }

      // Tag 0x9004: DateTimeDigitized
      if (tag === 0x9004 && !dateTimeStr) {
        const valOffset = view.getUint32(entryOffset + 8, littleEndian);
        dateTimeStr = readAsciiString(view, tiffStart + valOffset, 20);
      }
    }
  }

  if (dateTimeStr) {
    return parseExifDateString(dateTimeStr);
  }

  return null;
}

function readAsciiString(view: DataView, offset: number, maxLength: number): string | null {
  if (offset >= view.byteLength) return null;
  const chars: string[] = [];
  const limit = Math.min(view.byteLength, offset + maxLength);

  for (let i = offset; i < limit; i++) {
    const code = view.getUint8(i);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }

  return chars.join("").trim();
}
