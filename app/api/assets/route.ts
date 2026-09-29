import { NextRequest, NextResponse } from "next/server";
import { db, prisma } from "@/lib/db";
import { normalizePhash } from "@/lib/cloudinary";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractCloudinaryAiTags, extractCloudinaryExif } from "@/lib/ai/cloudinaryTagging";
import { runVisionFallback } from "@/lib/ai/visionFallback";
import { mapLabelToCategory, determinePrimaryCategory } from "@/lib/ai/categoryMapping";
import { generateEmbeddingForAsset } from "@/lib/ai/embeddings";
import { logEvent } from "@/lib/audit/logEvent";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;
    const category = searchParams.get("category") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const verdict = searchParams.get("verdict") || undefined;

    const where: any = {};

    // Integrity Engine verdict filter (VERIFIED | REVIEW | FLAGGED | UNVERIFIED)
    if (verdict === "UNVERIFIED") {
      where.AND = [{ OR: [{ integrity: null }, { integrity: { verdict: null } }] }];
    } else if (verdict === "VERIFIED" || verdict === "REVIEW" || verdict === "FLAGGED") {
      where.integrity = { verdict };
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (category && category.toLowerCase() !== "all") {
      if (category.toLowerCase() === "uncategorized") {
        where.OR = [
          { manualCategory: "Uncategorized" },
          { manualCategory: null },
          { manualCategory: "" },
        ];
      } else {
        where.manualCategory = category;
      }
    }

    if (from || to) {
      where.capturedAt = {};
      if (from) {
        where.capturedAt.gte = from.length === 10 ? new Date(`${from}T00:00:00.000Z`) : new Date(from);
      }
      if (to) {
        where.capturedAt.lte = to.length === 10 ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
      }
    }

    const assets = await db.mediaAsset.findMany({
      where,
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
        integrity: { select: INTEGRITY_SUMMARY },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, assets });
  } catch (error: any) {
    console.error("GET /api/assets error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch assets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      cloudinaryPublicId,
      secureUrl,
      resourceType,
      format,
      bytes,
      width,
      height,
      manualCategory,
      categorySource: explicitSource,
      manualLocation,
      manualNotes,
      capturedAt,
      uploadedBy,
      exifLat,
      exifLng,
      info, // Cloudinary upload info response if passed
      filename,
    } = body;

    if (!projectId || !cloudinaryPublicId || !secureUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "projectId, cloudinaryPublicId, and secureUrl are required",
        },
        { status: 400 }
      );
    }

    // Determine category and source
    const categorySource = explicitSource === "user" ? "user" : (manualCategory ? "user" : "ai");
    const initialCategory = manualCategory ? manualCategory.trim() : null;

    // Get session user or fallback
    const session = await getServerSession(authOptions);
    const finalUploadedBy =
      uploadedBy || (session?.user as any)?.id || "usr_demo123";

    // Ensure project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Extract EXIF from Cloudinary image_metadata if present
    let finalExifLat = exifLat ?? null;
    let finalExifLng = exifLng ?? null;
    let finalCapturedAt = capturedAt ? new Date(capturedAt) : null;

    if (info?.image_metadata) {
      const extracted = extractCloudinaryExif(info.image_metadata);
      if (extracted.exifLat !== null) finalExifLat = extracted.exifLat;
      if (extracted.exifLng !== null) finalExifLng = extracted.exifLng;
      if (extracted.capturedAt && !finalCapturedAt) {
        finalCapturedAt = new Date(extracted.capturedAt);
      }
    }

    // Do NOT fall back capturedAt to upload date: assets without capturedAt must have capturedAt null

    // Check for inline Cloudinary AI tags
    const inlineAiTags = extractCloudinaryAiTags(info);
    const hasInlineTags = inlineAiTags.length > 0;

    // Create the media asset in DB
    const asset = await db.mediaAsset.create({
      data: {
        projectId,
        cloudinaryPublicId,
        secureUrl,
        resourceType: resourceType || "image",
        format: format || (resourceType === "video" ? "mp4" : "jpg"),
        bytes: Number(bytes) || 0,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        manualCategory: initialCategory,
        categorySource,
        manualLocation: manualLocation?.trim() || null,
        manualNotes: manualNotes?.trim() || null,
        capturedAt: finalCapturedAt,
        uploadedBy: finalUploadedBy,
        exifLat: finalExifLat,
        exifLng: finalExifLng,
        aiProcessingStatus: hasInlineTags ? "done" : "pending",
      },
    });

    // Integrity Engine fingerprints (Cloudinary etag = MD5, phash = 64-bit perceptual hash)
    // and a pending integrity record. Needs PostgreSQL; skipped in file-store mode.
    try {
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          etag: typeof info?.etag === "string" ? info.etag : null,
          phash: normalizePhash(info?.phash),
          integrity: { create: {} },
        },
      });
    } catch (err) {
      console.warn("[integrity] could not store fingerprints:", (err as Error).message);
    }

    // Log upload event for asset traceability
    await logEvent(
      asset.id,
      "uploaded",
      { format: asset.format, bytes: asset.bytes, resourceType: asset.resourceType },
      asset.uploadedBy
    );

    // If inline tags were available from Cloudinary, write them immediately
    if (hasInlineTags) {
      console.log(
        `[AI Tagging] Asset ${asset.id} (${inlineAiTags[0]?.source || "cloudinary_google"}) raw labels:`,
        inlineAiTags.map((t) => `${t.label} (${t.confidence})`).join(", ")
      );

      // Clean up any stale tags or categories (Requirement 7)
      await db.aiTag.deleteMany({ where: { mediaAssetId: asset.id } });
      await db.mediaAssetCategory.deleteMany({ where: { mediaAssetId: asset.id } });

      for (const t of inlineAiTags) {
        await db.aiTag.create({
          data: {
            mediaAssetId: asset.id,
            label: t.label,
            confidence: t.confidence,
            source: t.source,
          },
        });
      }

      // Assign ONE primary category based on highest total confidence (Requirement 5)
      const primaryCategory = determinePrimaryCategory(inlineAiTags);
      console.log(
        `[AI Tagging] Asset ${asset.id} primary category assigned: ${primaryCategory}`
      );

      const cat = await db.category.upsert({
        where: { name: primaryCategory },
        update: {},
        create: { name: primaryCategory },
      });

      await db.mediaAssetCategory.create({
        data: { mediaAssetId: asset.id, categoryId: cat.id },
      });

      // If categorySource is "ai", update manualCategory with the AI primary category
      if (asset.categorySource === "ai") {
        await db.mediaAsset.update({
          where: { id: asset.id },
          data: { manualCategory: primaryCategory },
        });
      }

      await logEvent(
        asset.id,
        "ai_tagged",
        {
          tags: inlineAiTags.map((t) => t.label),
          confidences: inlineAiTags.map((t) => t.confidence),
          source: inlineAiTags[0]?.source || "cloudinary_google",
          primaryCategory,
        },
        "system-ai"
      );

      // Automatically generate text embedding for pgvector search (Task 3.2)
      generateEmbeddingForAsset(asset.id).catch((err) => {
        console.error("Auto generateEmbeddingForAsset error:", err);
      });
    } else {
      // Asynchronous fallback: Google Vision or fail gracefully without mock tags
      runVisionFallback(asset.id, asset.secureUrl, {
        filename: filename || cloudinaryPublicId,
        manualNotes: asset.manualNotes || undefined,
        manualLocation: asset.manualLocation || undefined,
      }).catch((err) => {
        console.error("Async runVisionFallback background error:", err);
      });
    }

    // Refresh asset to include aiTags and categories if created inline
    const finalAsset = await db.mediaAsset.findUnique({
      where: { id: asset.id },
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
      },
    }) || asset;

    return NextResponse.json({ success: true, asset: finalAsset }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/assets error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create media asset" },
      { status: 500 }
    );
  }
}
