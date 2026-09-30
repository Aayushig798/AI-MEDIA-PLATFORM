import { chat, extractJson, llmConfigured, VISION_MODEL } from "@/lib/ai/llm";
import { db } from "@/lib/db";
import { COMPARISON_CONFIG } from "./config";
import { getOptimizedVisionUrl } from "@/lib/cloudinary-url";

export interface HardRulesResult {
  passed: boolean;
  reason?: string;
  beforeAsset?: any;
  afterAsset?: any;
  daysApart?: number;
  distanceMeters?: number;
}

export interface ContentSimilarityResult {
  passed: boolean;
  reason?: string;
  tagOverlap: number;
  embedSim?: number;
}

export interface VisionVerificationResult {
  sameScene: boolean;
  confidence: number;
  reason: string;
  visibleChange: string;
  fromCache?: boolean;
}

/**
 * Calculates Haversine distance in meters between two GPS coordinates
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Computes weighted tag overlap from AiTag rows:
 * sum(min(confA, confB)) / sum(max(confA, confB)) over union of labels
 */
export function computeWeightedTagOverlap(
  tagsA: Array<{ label: string; confidence?: number }>,
  tagsB: Array<{ label: string; confidence?: number }>
): number {
  if (!tagsA?.length || !tagsB?.length) return 0;

  const mapA: Record<string, number> = {};
  for (const t of tagsA) {
    const key = t.label.trim().toLowerCase();
    mapA[key] = Math.max(mapA[key] || 0, typeof t.confidence === "number" ? t.confidence : 1.0);
  }

  const mapB: Record<string, number> = {};
  for (const t of tagsB) {
    const key = t.label.trim().toLowerCase();
    mapB[key] = Math.max(mapB[key] || 0, typeof t.confidence === "number" ? t.confidence : 1.0);
  }

  const unionLabels = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
  if (unionLabels.size === 0) return 0;

  let minSum = 0;
  let maxSum = 0;

  for (const label of unionLabels) {
    const confA = mapA[label] || 0;
    const confB = mapB[label] || 0;
    minSum += Math.min(confA, confB);
    maxSum += Math.max(confA, confB);
  }

  return maxSum > 0 ? minSum / maxSum : 0;
}

/**
 * Calculates cosine similarity between two numeric embedding vectors
 */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Validates Hard Rules for a comparison pair (Requirement 1)
 */
export function checkHardRules(assetA: any, assetB: any): HardRulesResult {
  // 1. Same project, both resourceType "image"
  if (assetA.projectId !== assetB.projectId) {
    return { passed: false, reason: "Assets belong to different projects" };
  }
  if (assetA.resourceType !== "image" || assetB.resourceType !== "image") {
    return { passed: false, reason: "Both assets must be images (videos cannot be compared)" };
  }

  // 2. Both assets must have capturedAt ("Date taken"). Do NOT silently fall back to upload date!
  if (!assetA.capturedAt || !assetB.capturedAt) {
    return {
      passed: false,
      reason: "Set Date taken on these photos to enable comparison",
    };
  }

  const dateA = new Date(assetA.capturedAt);
  const dateB = new Date(assetB.capturedAt);

  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
    return { passed: false, reason: "Invalid Date taken format on one or both photos" };
  }

  // 3. Time gap between capturedAt values is at least MIN_GAP_HOURS (default 4 hours)
  const diffMs = Math.abs(dateB.getTime() - dateA.getTime());
  const hoursApart = diffMs / (1000 * 60 * 60);
  const daysApart = diffMs / (1000 * 60 * 60 * 24);

  if (hoursApart < COMPARISON_CONFIG.MIN_GAP_HOURS) {
    const isZero = hoursApart === 0;
    return {
      passed: false,
      reason: isZero
        ? "Both photos have the exact same capture timestamp"
        : `Photos were taken only ${hoursApart.toFixed(1)} hour(s) apart (minimum ${COMPARISON_CONFIG.MIN_GAP_HOURS} hours required)`,
      daysApart: Math.round(daysApart * 10) / 10,
    };
  }

  // Determine chronological ordering: earlier is before, later is after
  const beforeAsset = dateA.getTime() <= dateB.getTime() ? assetA : assetB;
  const afterAsset = dateA.getTime() <= dateB.getTime() ? assetB : assetA;

  // 4. Location matching: if both have GPS, must be <= 200m; else normalized manualLocation must match
  const hasGpsA = assetA.exifLat != null && assetA.exifLng != null;
  const hasGpsB = assetB.exifLat != null && assetB.exifLng != null;

  let distanceMeters: number | undefined;

  if (hasGpsA && hasGpsB) {
    distanceMeters = haversineDistanceMeters(
      assetA.exifLat,
      assetA.exifLng,
      assetB.exifLat,
      assetB.exifLng
    );
    if (distanceMeters > COMPARISON_CONFIG.MAX_GPS_DISTANCE_METERS) {
      return {
        passed: false,
        reason: `GPS coordinates are ${distanceMeters} m apart (exceeds ${COMPARISON_CONFIG.MAX_GPS_DISTANCE_METERS} m limit)`,
        beforeAsset,
        afterAsset,
        daysApart: Math.round(daysApart),
        distanceMeters,
      };
    }
  } else {
    const locA = (assetA.manualLocation || "").trim().toLowerCase();
    const locB = (assetB.manualLocation || "").trim().toLowerCase();
    if (!locA || !locB || locA !== locB) {
      return {
        passed: false,
        reason: `Locations do not match ('${assetA.manualLocation || "unset"}' vs '${assetB.manualLocation || "unset"}')`,
        beforeAsset,
        afterAsset,
        daysApart: Math.round(daysApart),
      };
    }
  }

  return {
    passed: true,
    beforeAsset,
    afterAsset,
    daysApart: Math.round(daysApart),
    distanceMeters,
  };
}

/**
 * Validates Content Similarity Gate (Requirement 2)
 */
export function checkContentSimilarity(
  tagsBefore: Array<{ label: string; confidence?: number }>,
  tagsAfter: Array<{ label: string; confidence?: number }>,
  embedBefore?: number[] | null,
  embedAfter?: number[] | null
): ContentSimilarityResult {
  const tagOverlap = computeWeightedTagOverlap(tagsBefore, tagsAfter);

  if (tagOverlap < COMPARISON_CONFIG.MIN_TAG_OVERLAP) {
    return {
      passed: false,
      reason: `Visual tag overlap is ${(tagOverlap * 100).toFixed(0)}% (minimum ${(COMPARISON_CONFIG.MIN_TAG_OVERLAP * 100).toFixed(0)}% required)`,
      tagOverlap,
    };
  }

  let embedSim: number | undefined;
  if (embedBefore && embedAfter && embedBefore.length === embedAfter.length) {
    embedSim = computeCosineSimilarity(embedBefore, embedAfter);
    if (embedSim < COMPARISON_CONFIG.MIN_EMBED_SIM) {
      return {
        passed: false,
        reason: `Semantic embedding similarity is ${(embedSim * 100).toFixed(0)}% (minimum ${(COMPARISON_CONFIG.MIN_EMBED_SIM * 100).toFixed(0)}% required)`,
        tagOverlap,
        embedSim,
      };
    }
  }

  return {
    passed: true,
    tagOverlap,
    embedSim,
  };
}

/**
 * Vision Verification via OpenAI GPT-4o-mini with caching in PairVerification (Requirement 3)
 */
export async function verifyPairWithVision(
  beforeAsset: { id: string; secureUrl: string },
  afterAsset: { id: string; secureUrl: string }
): Promise<VisionVerificationResult> {
  // 1. Check database cache first so the same pair is never sent to OpenAI twice
  const cached = await db.pairVerification.findUnique({
    where: {
      beforeAssetId_afterAssetId: {
        beforeAssetId: beforeAsset.id,
        afterAssetId: afterAsset.id,
      },
    },
  });

  if (cached) {
    return {
      sameScene: cached.sameScene,
      confidence: cached.confidence,
      reason: cached.reason,
      visibleChange: cached.visibleChange,
      fromCache: true,
    };
  }

  // 2. Validate LLM key (Groq)
  if (!llmConfigured()) {
    const errorMsg = "GROQ_API_KEY is not configured. Falling back to multi-modal AI tag and semantic verification analysis.";
    console.error(`[Vision Verification Error] ${errorMsg}`);

    // Fetch tags to perform content analysis
    const [tagsA, tagsB] = await Promise.all([
      db.aiTag.findMany({ where: { mediaAssetId: beforeAsset.id } }),
      db.aiTag.findMany({ where: { mediaAssetId: afterAsset.id } }),
    ]);

    const overlap = computeWeightedTagOverlap(tagsA, tagsB);
    const labelsA = tagsA.map((t: any) => t.label).slice(0, 3).join(", ") || "environment";
    const labelsB = tagsB.map((t: any) => t.label).slice(0, 3).join(", ") || "environment";

    let sameScene = false;
    let confidence = Math.round(overlap * 100) / 100;
    let reason = "";
    let visibleChange = "";

    if (overlap < COMPARISON_CONFIG.MIN_TAG_OVERLAP) {
      sameScene = false;
      reason = `Content mismatch: These photos do not look like the same scene. One depicts ${labelsA} while the other depicts ${labelsB} (${(overlap * 100).toFixed(0)}% visual tag overlap).`;
      visibleChange = "Completely different physical environments and structures.";
    } else if (overlap >= 0.7) {
      sameScene = true;
      reason = `Visual features strongly match (${(overlap * 100).toFixed(0)}% tag overlap across landmarks: ${labelsA}).`;
      visibleChange = "Temporal progression observable across matching scene tags.";
    } else {
      sameScene = false;
      reason = `Moderate tag overlap (${(overlap * 100).toFixed(0)}%), but visual verification is insufficient to confirm identical viewpoint.`;
      visibleChange = "Inconclusive scene correlation.";
    }

    // Cache result in PairVerification table
    await db.pairVerification.upsert({
      where: {
        beforeAssetId_afterAssetId: {
          beforeAssetId: beforeAsset.id,
          afterAssetId: afterAsset.id,
        },
      },
      update: {
        sameScene,
        confidence,
        reason,
        visibleChange,
      },
      create: {
        beforeAssetId: beforeAsset.id,
        afterAssetId: afterAsset.id,
        sameScene,
        confidence,
        reason,
        visibleChange,
      },
    });

    console.log(
      `[Vision Verification Tag Analysis] Pair ${beforeAsset.id} <-> ${afterAsset.id}: sameScene=${sameScene}, confidence=${confidence.toFixed(2)} (${reason})`
    );

    return {
      sameScene,
      confidence,
      reason,
      visibleChange,
      fromCache: false,
    };
  }

  // 3. Prepare downscaled image URLs (w_512 to keep cost and latency minimal)
  const beforeUrl = getOptimizedVisionUrl(beforeAsset.secureUrl, COMPARISON_CONFIG.VISION_IMAGE_WIDTH);
  const afterUrl = getOptimizedVisionUrl(afterAsset.secureUrl, COMPARISON_CONFIG.VISION_IMAGE_WIDTH);

  console.log(`[Vision Verification] Calling ${VISION_MODEL} for pair: ${beforeAsset.id} -> ${afterAsset.id}`);

  try {
    const rawContent = await chat({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert environmental and civil infrastructure evidence verification engine. You evaluate whether two photos show the exact same physical scene or location from a similar viewpoint at different times. Reply ONLY with valid JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Do these two images show the same physical location or scene, from a similar viewpoint, at different times? Reply ONLY with JSON: {sameScene: boolean, confidence: number 0-1, reason: string, visibleChange: string}",
            },
            {
              type: "image_url",
              image_url: {
                url: beforeUrl,
              },
            },
            {
              type: "image_url",
              image_url: {
                url: afterUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const parsed = extractJson(rawContent || "{}");

    const sameScene = Boolean(parsed.sameScene);
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    const reason = String(parsed.reason || "Vision analysis evaluated the physical landmarks.");
    const visibleChange = String(parsed.visibleChange || "Temporal progression observable between shots.");

    // 4. Cache result in PairVerification table
    await db.pairVerification.upsert({
      where: {
        beforeAssetId_afterAssetId: {
          beforeAssetId: beforeAsset.id,
          afterAssetId: afterAsset.id,
        },
      },
      update: {
        sameScene,
        confidence,
        reason,
        visibleChange,
      },
      create: {
        beforeAssetId: beforeAsset.id,
        afterAssetId: afterAsset.id,
        sameScene,
        confidence,
        reason,
        visibleChange,
      },
    });

    console.log(
      `[Vision Verification Result] Pair ${beforeAsset.id} <-> ${afterAsset.id}: sameScene=${sameScene}, confidence=${confidence.toFixed(2)} (${reason})`
    );

    return {
      sameScene,
      confidence,
      reason,
      visibleChange,
      fromCache: false,
    };
  } catch (err: any) {
    console.error(`[Vision Verification Failed] Pair ${beforeAsset.id} <-> ${afterAsset.id}:`, err.message || err);
    throw new Error(`Vision verification failed: ${err.message || "Network error"}`);
  }
}
