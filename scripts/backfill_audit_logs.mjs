import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[Audit Backfill] Starting audit log backfill for existing DB records...");
  
  const assets = await prisma.mediaAsset.findMany({
    include: {
      aiTags: true,
      embedding: true,
    },
  });

  console.log(`[Audit Backfill] Found ${assets.length} assets.`);

  for (const asset of assets) {
    // 1. Check if "uploaded" log exists
    const existingUpload = await prisma.assetAuditLog.findFirst({
      where: { mediaAssetId: asset.id, eventType: "uploaded" },
    });
    if (!existingUpload) {
      await prisma.assetAuditLog.create({
        data: {
          mediaAssetId: asset.id,
          eventType: "uploaded",
          eventDetail: {
            format: asset.format,
            bytes: asset.bytes,
            resourceType: asset.resourceType,
            capturedAt: asset.capturedAt,
          },
          actor: asset.uploadedBy || "usr_demo123",
          createdAt: asset.createdAt,
        },
      });
      console.log(`[Audit Backfill] Logged "uploaded" for asset ${asset.id}`);
    }

    // 2. Check if "ai_tagged" log exists
    if (asset.aiTags && asset.aiTags.length > 0) {
      const existingAiTag = await prisma.assetAuditLog.findFirst({
        where: { mediaAssetId: asset.id, eventType: "ai_tagged" },
      });
      if (!existingAiTag) {
        await prisma.assetAuditLog.create({
          data: {
            mediaAssetId: asset.id,
            eventType: "ai_tagged",
            eventDetail: {
              tags: asset.aiTags.map((t) => t.label),
              confidences: asset.aiTags.map((t) => t.confidence),
              primaryCategory: asset.manualCategory,
              source: asset.aiTags[0]?.source || "cloudinary_google",
            },
            actor: "system-ai",
            createdAt: asset.updatedAt,
          },
        });
        console.log(`[Audit Backfill] Logged "ai_tagged" for asset ${asset.id} (${asset.aiTags.length} tags)`);
      }
    }

    // 3. Check if "embedded" log exists
    if (asset.embedding) {
      const existingEmbed = await prisma.assetAuditLog.findFirst({
        where: { mediaAssetId: asset.id, eventType: "embedded" },
      });
      if (!existingEmbed) {
        await prisma.assetAuditLog.create({
          data: {
            mediaAssetId: asset.id,
            eventType: "embedded",
            eventDetail: {
              model: asset.embedding.modelVersion || "text-embedding-3-small",
              dimensions: 1536,
            },
            actor: "system-ai",
            createdAt: asset.embedding.createdAt,
          },
        });
        console.log(`[Audit Backfill] Logged "embedded" for asset ${asset.id}`);
      }
    }
  }

  // 4. Check existing comparisons
  const comparisons = await prisma.comparison.findMany();
  console.log(`[Audit Backfill] Found ${comparisons.length} comparisons.`);

  for (const comp of comparisons) {
    for (const [assetId, role] of [
      [comp.beforeAssetId, "before"],
      [comp.afterAssetId, "after"],
    ]) {
      const existingCompLog = await prisma.assetAuditLog.findFirst({
        where: {
          mediaAssetId: assetId,
          eventType: "used_in_comparison",
          eventDetail: { path: ["comparisonId"], equals: comp.id },
        },
      });
      if (!existingCompLog) {
        await prisma.assetAuditLog.create({
          data: {
            mediaAssetId: assetId,
            eventType: "used_in_comparison",
            eventDetail: {
              comparisonId: comp.id,
              role,
              verified: comp.verified,
              matchConfidence: comp.matchConfidence,
            },
            actor: comp.createdBy || "usr_demo123",
            createdAt: comp.createdAt,
          },
        });
        console.log(`[Audit Backfill] Logged "used_in_comparison" for asset ${assetId}`);
      }
    }
  }

  console.log("[Audit Backfill] Complete!");
}

main()
  .catch((err) => {
    console.error("[Audit Backfill Error]", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
