import { db } from "@/lib/db";
import { determinePrimaryCategory, DomainCategory } from "./categoryMapping";
import { generateEmbeddingForAsset } from "./embeddings";

export interface VisionLabelResult {
  label: string;
  confidence: number;
  source: "cloudinary_google" | "cloudinary_rekognition" | "external_vision";
}

/**
 * Real Vision Fallback Engine
 * Calls Google Cloud Vision LABEL_DETECTION using GOOGLE_VISION_API_KEY when Cloudinary add-on tags are absent.
 * If no real tags can be obtained, marks the asset as "failed" and never invents mock tags.
 */
export async function runVisionFallback(
  assetId: string,
  secureUrl: string,
  options: {
    filename?: string;
    manualNotes?: string;
    manualLocation?: string;
  } = {}
) {
  try {
    // 1. Set status to processing
    await db.mediaAsset.update({
      where: { id: assetId },
      data: { aiProcessingStatus: "processing" },
    });

    const detectedLabels: VisionLabelResult[] = [];
    const googleApiKey = process.env.GOOGLE_VISION_API_KEY;

    // 2. Call Google Cloud Vision API if key is configured
    if (googleApiKey && secureUrl && secureUrl.startsWith("http")) {
      try {
        const visionRes = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [
                {
                  image: { source: { imageUri: secureUrl } },
                  features: [{ type: "LABEL_DETECTION", maxResults: 15 }],
                },
              ],
            }),
          }
        );

        if (visionRes.ok) {
          const visionData = await visionRes.json();
          const annotations = visionData.responses?.[0]?.labelAnnotations || [];
          for (const item of annotations) {
            if (item.description && typeof item.score === "number") {
              detectedLabels.push({
                label: item.description.trim(),
                confidence: Math.round(item.score * 1000) / 1000,
                source: "external_vision",
              });
            }
          }
        } else {
          const errText = await visionRes.text();
          console.warn(`[Vision API] Google Cloud Vision returned ${visionRes.status}:`, errText);
        }
      } catch (err: any) {
        console.warn("[Vision API] Google Cloud Vision request error:", err.message || err);
      }
    }

    // 3. If no real tags were obtained, FAIL GRACEFULLY - DO NOT INVENT MOCK TAGS
    if (detectedLabels.length === 0) {
      const missingReason = !googleApiKey
        ? "Google Auto Tagging add-on returned no data and GOOGLE_VISION_API_KEY not set"
        : "Google Auto Tagging add-on returned no data and Google Cloud Vision API returned 0 labels";

      console.error(
        `[AI Tagging Failed] Asset ${assetId}: ${missingReason}. No mock tags will be generated.`
      );

      // Clean up any stale tags or categories
      await db.aiTag.deleteMany({ where: { mediaAssetId: assetId } });
      await db.mediaAssetCategory.deleteMany({ where: { mediaAssetId: assetId } });

      const currentFailed = await db.mediaAsset.findUnique({ where: { id: assetId } });
      const failedUpdateData: any = { aiProcessingStatus: "failed" };
      if (currentFailed?.categorySource !== "user") {
        failedUpdateData.manualCategory = "Uncategorized";
      }

      const failedAsset = await db.mediaAsset.update({
        where: { id: assetId },
        data: failedUpdateData,
      });

      return {
        success: false,
        asset: failedAsset,
        tagsCount: 0,
        categories: [],
        error: missingReason,
      };
    }

    // 4. Log raw labels and confidences (Requirement 6)
    console.log(
      `[AI Tagging] Asset ${assetId} (external_vision) raw labels:`,
      detectedLabels.map((t) => `${t.label} (${t.confidence})`).join(", ")
    );

    // 5. Clean up old tags before writing new ones (Requirement 7)
    await db.aiTag.deleteMany({ where: { mediaAssetId: assetId } });
    await db.mediaAssetCategory.deleteMany({ where: { mediaAssetId: assetId } });

    // 6. Save real AI tags
    for (const item of detectedLabels) {
      await db.aiTag.create({
        data: {
          mediaAssetId: assetId,
          label: item.label,
          confidence: item.confidence,
          source: "external_vision",
        },
      });
    }

    // 7. Assign ONE primary category based on highest total confidence (Requirement 5)
    const primaryCategory = determinePrimaryCategory(detectedLabels);
    console.log(
      `[AI Tagging] Asset ${assetId} primary category assigned: ${primaryCategory}`
    );

    const cat = await db.category.upsert({
      where: { name: primaryCategory },
      update: {},
      create: { name: primaryCategory },
    });

    await db.mediaAssetCategory.create({
      data: {
        mediaAssetId: assetId,
        categoryId: cat.id,
      },
    });

    // 8. Update status to done, only update manualCategory if categorySource is "ai"
    const currentAsset = await db.mediaAsset.findUnique({ where: { id: assetId } });
    const updateData: any = { aiProcessingStatus: "done" };
    if (currentAsset?.categorySource !== "user") {
      updateData.manualCategory = primaryCategory;
    }

    const updatedAsset = await db.mediaAsset.update({
      where: { id: assetId },
      data: updateData,
    });

    // Automatically generate text embedding for pgvector search (Task 3.2)
    generateEmbeddingForAsset(assetId).catch((err) => {
      console.error("Auto generateEmbeddingForAsset error:", err);
    });

    return {
      success: true,
      asset: updatedAsset,
      tagsCount: detectedLabels.length,
      categories: [primaryCategory],
    };
  } catch (error: any) {
    console.error(`runVisionFallback error for asset ${assetId}:`, error);
    await db.mediaAsset.update({
      where: { id: assetId },
      data: { aiProcessingStatus: "failed" },
    });
    throw error;
  }
}
