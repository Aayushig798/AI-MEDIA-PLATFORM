import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { extractCloudinaryAiTags } from "@/lib/ai/cloudinaryTagging";
import { runVisionFallback } from "@/lib/ai/visionFallback";
import { logEvent } from "@/lib/audit/logEvent";
import { determinePrimaryCategory } from "@/lib/ai/categoryMapping";
import { generateEmbeddingForAsset } from "@/lib/ai/embeddings";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const asset = await db.mediaAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Media asset not found" },
        { status: 404 }
      );
    }

    // Requirement 7: Explicitly delete old AiTag and MediaAssetCategory rows first
    await db.aiTag.deleteMany({ where: { mediaAssetId: id } });
    await db.mediaAssetCategory.deleteMany({ where: { mediaAssetId: id } });

    // Step 2a: Check Cloudinary for existing add-on categorization if asset has a publicId
    let cloudinaryTags: any[] = [];
    if (asset.cloudinaryPublicId && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const resource = await cloudinary.api.resource(asset.cloudinaryPublicId, {
          image_metadata: true,
          resource_type: asset.resourceType === "video" ? "video" : "image",
        });
        cloudinaryTags = extractCloudinaryAiTags(resource);
      } catch (cldErr: any) {
        console.warn(`[Analyze] Cloudinary api.resource check for ${asset.cloudinaryPublicId}:`, cldErr.message || cldErr);
      }
    }

    if (cloudinaryTags.length > 0) {
      // Real tags from Cloudinary Google Auto Tagging add-on
      console.log(
        `[AI Tagging] Asset ${id} (${cloudinaryTags[0]?.source || "cloudinary_google"}) raw labels:`,
        cloudinaryTags.map((t) => `${t.label} (${t.confidence})`).join(", ")
      );

      for (const t of cloudinaryTags) {
        await db.aiTag.create({
          data: {
            mediaAssetId: id,
            label: t.label,
            confidence: t.confidence,
            source: t.source,
          },
        });
      }

      // Assign ONE primary category (Requirement 5)
      const primaryCategory = determinePrimaryCategory(cloudinaryTags);
      console.log(
        `[AI Tagging] Asset ${id} primary category assigned: ${primaryCategory}`
      );

      const cat = await db.category.upsert({
        where: { name: primaryCategory },
        update: {},
        create: { name: primaryCategory },
      });

      await db.mediaAssetCategory.create({
        data: {
          mediaAssetId: id,
          categoryId: cat.id,
        },
      });

      const updateData: any = { aiProcessingStatus: "done" };
      if (asset.categorySource !== "user") {
        updateData.manualCategory = primaryCategory;
      }

      await db.mediaAsset.update({
        where: { id },
        data: updateData,
      });

      await logEvent(
        id,
        "ai_tagged",
        {
          tags: cloudinaryTags.map((t) => t.label),
          confidences: cloudinaryTags.map((t) => t.confidence),
          source: cloudinaryTags[0]?.source || "cloudinary_google",
          primaryCategory,
          trigger: "manual re-analyze",
        },
        "system-ai"
      );

      // Automatically generate text embedding for pgvector search (Task 3.2)
      generateEmbeddingForAsset(id).catch((err) => {
        console.error("Auto generateEmbeddingForAsset error:", err);
      });
    } else {
      // Step 2b: Fallback to Google Cloud Vision or mark failed (no mock tags)
      await runVisionFallback(asset.id, asset.secureUrl, {
        filename: asset.cloudinaryPublicId,
        manualNotes: asset.manualNotes || undefined,
        manualLocation: asset.manualLocation || undefined,
      });
    }

    const refreshedAsset = await db.mediaAsset.findUnique({
      where: { id },
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
      },
    });

    const isSuccess = refreshedAsset?.aiProcessingStatus === "done";

    return NextResponse.json({
      success: isSuccess,
      message: isSuccess ? "AI analysis completed successfully" : "AI analysis could not detect labels",
      asset: refreshedAsset,
      aiTags: refreshedAsset?.aiTags || [],
      categories: refreshedAsset?.categories?.map((c: any) => c.category?.name || c.name) || [],
    });
  } catch (error: any) {
    console.error(`POST /api/assets/${params.id}/analyze error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to analyze asset" },
      { status: 500 }
    );
  }
}
