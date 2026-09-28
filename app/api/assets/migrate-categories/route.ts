import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { determinePrimaryCategory } from "@/lib/ai/categoryMapping";

export async function POST(req: NextRequest) {
  try {
    const assets = await db.mediaAsset.findMany({
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
      },
    });

    let updatedCount = 0;
    let skippedCount = 0;
    const results: any[] = [];

    for (const asset of assets) {
      // Do not run on assets clearly edited by user
      if (asset.categorySource === "user") {
        skippedCount++;
        results.push({ id: asset.id, status: "skipped", reason: "user_edited" });
        continue;
      }

      // Compute primary category
      let primaryCategory = determinePrimaryCategory(((asset as any).aiTags || []) as any);
      if (primaryCategory === "Uncategorized" && (asset as any).categories?.length > 0) {
        const catName = (asset as any).categories[0]?.category?.name || (asset as any).categories[0]?.name;
        if (catName) primaryCategory = catName;
      }

      const cat = await db.category.upsert({
        where: { name: primaryCategory },
        update: {},
        create: { name: primaryCategory },
      });

      await db.mediaAssetCategory.deleteMany({ where: { mediaAssetId: asset.id } });
      await db.mediaAssetCategory.create({
        data: { mediaAssetId: asset.id, categoryId: cat.id },
      });

      const updated = await db.mediaAsset.update({
        where: { id: asset.id },
        data: {
          manualCategory: primaryCategory,
          categorySource: "ai",
        },
      });

      updatedCount++;
      results.push({
        id: asset.id,
        status: "updated",
        oldCategory: asset.manualCategory,
        newCategory: primaryCategory,
        categorySource: "ai",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete. Updated ${updatedCount} assets, skipped ${skippedCount}.`,
      updatedCount,
      skippedCount,
      results,
    });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to migrate categories" },
      { status: 500 }
    );
  }
}
