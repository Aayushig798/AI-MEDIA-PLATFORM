import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

    // Integrity Engine verdict filter (VERIFIED | REVIEW | FLAGGED | UNVERIFIED).
    // A reviewer's decision overrides the machine verdict.
    const and: any[] = [];
    if (verdict === "UNVERIFIED") {
      and.push({ OR: [{ integrity: null }, { integrity: { status: { not: "DONE" } } }] });
    } else if (verdict === "VERIFIED") {
      and.push({
        integrity: {
          status: "DONE",
          OR: [{ reviewDecision: "APPROVED" }, { reviewDecision: null, verdict: "VERIFIED" }],
        },
      });
    } else if (verdict === "FLAGGED") {
      and.push({
        integrity: {
          status: "DONE",
          OR: [{ reviewDecision: "REJECTED" }, { reviewDecision: null, verdict: "FLAGGED" }],
        },
      });
    } else if (verdict === "REVIEW") {
      and.push({ integrity: { status: "DONE", reviewDecision: null, verdict: "REVIEW" } });
    }

    // Filter by the AI-assigned domain category
    const aiCategory = searchParams.get("aiCategory") || undefined;
    if (aiCategory && aiCategory.toLowerCase() !== "all") {
      and.push({ categories: { some: { category: { name: { equals: aiCategory, mode: "insensitive" } } } } });
    }
    if (and.length > 0) where.AND = and;

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
      select: { id: true },
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
    // Pure function of the tags, so it's known before the asset is written
    const primaryCategory = hasInlineTags ? determinePrimaryCategory(inlineAiTags) : null;

    // Create the media asset in DB, with the Integrity Engine fingerprints (Cloudinary etag =
    // MD5, phash = 64-bit perceptual hash) and a pending integrity record in the same write.
    // The fingerprint fields only exist in PostgreSQL mode; the file store ignores them.
    const asset = await db.mediaAsset.create({
      data: {
        ...(await db.isPrismaConnected() && {
          etag: typeof info?.etag === "string" ? info.etag : null,
          phash: normalizePhash(info?.phash),
          integrity: { create: {} },
        }),
        projectId,
        cloudinaryPublicId,
        secureUrl,
        resourceType: resourceType || "image",
        format: format || (resourceType === "video" ? "mp4" : "jpg"),
        bytes: Number(bytes) || 0,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        // If categorySource is "ai", the AI primary category becomes manualCategory
        manualCategory: categorySource === "ai" && primaryCategory ? primaryCategory : initialCategory,
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

    // Log upload event for asset traceability (runs while the tags are written)
    const uploadLogged = logEvent(
      asset.id,
      "uploaded",
      { format: asset.format, bytes: asset.bytes, resourceType: asset.resourceType },
      asset.uploadedBy
    );

    // If inline tags were available from Cloudinary, write them immediately
    if (hasInlineTags && primaryCategory) {
      console.log(
        `[AI Tagging] Asset ${asset.id} (${inlineAiTags[0]?.source || "cloudinary_google"}) raw labels:`,
        inlineAiTags.map((t) => `${t.label} (${t.confidence})`).join(", ")
      );
      // ONE primary category based on highest total confidence (Requirement 5)
      console.log(
        `[AI Tagging] Asset ${asset.id} primary category assigned: ${primaryCategory}`
      );

      // The asset is brand new, so there are no stale tags or categories to clear first
      await Promise.all([
        db.aiTag.createMany({
          data: inlineAiTags.map((t) => ({
            mediaAssetId: asset.id,
            label: t.label,
            confidence: t.confidence,
            source: t.source,
          })),
        }),
        db.category
          .upsert({
            where: { name: primaryCategory },
            update: {},
            create: { name: primaryCategory },
          })
          .then((cat) =>
            db.mediaAssetCategory.create({
              data: { mediaAssetId: asset.id, categoryId: cat.id },
            })
          ),
      ]);

      // Ledger order: "uploaded" before "ai_tagged"
      await uploadLogged;
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
      // (starts after the "uploaded" ledger entry so the chain keeps its order)
      uploadLogged.then(() => runVisionFallback(asset.id, asset.secureUrl, {
        filename: filename || cloudinaryPublicId,
        manualNotes: asset.manualNotes || undefined,
        manualLocation: asset.manualLocation || undefined,
      })).catch((err) => {
        console.error("Async runVisionFallback background error:", err);
      });
    }

    await uploadLogged;

    // Refresh asset to include aiTags and categories if created inline
    const finalAsset = hasInlineTags
      ? (await db.mediaAsset.findUnique({
          where: { id: asset.id },
          include: {
            aiTags: { orderBy: { confidence: "desc" } },
            categories: { include: { category: true } },
          },
        })) || asset
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
