import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractCloudinaryAiTags, extractCloudinaryExif } from "@/lib/ai/cloudinaryTagging";
import { runVisionFallback } from "@/lib/ai/visionFallback";
import { mapLabelToCategory, determinePrimaryCategory } from "@/lib/ai/categoryMapping";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;
    const category = searchParams.get("category") || undefined;
    const aiCategory = searchParams.get("aiCategory") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const where: any = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (category && category !== "ALL") {
      where.manualCategory = category;
    }

    if (aiCategory && aiCategory !== "ALL") {
      where.aiCategory = aiCategory;
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

    // Fallback capturedAt to now if not set
    if (!finalCapturedAt) {
      finalCapturedAt = new Date();
    }

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
        manualCategory: manualCategory?.trim() || null,
        manualLocation: manualLocation?.trim() || null,
        manualNotes: manualNotes?.trim() || null,
        capturedAt: finalCapturedAt,
        uploadedBy: finalUploadedBy,
        exifLat: finalExifLat,
        exifLng: finalExifLng,
        aiProcessingStatus: hasInlineTags ? "done" : "pending",
      },
    });

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
    const finalAsset = hasInlineTags 
      ? (await db.mediaAsset.findUnique({ where: { id: asset.id } })) || asset
      : asset;

    return NextResponse.json({ success: true, asset: finalAsset }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/assets error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create media asset" },
      { status: 500 }
    );
  }
}
