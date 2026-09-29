import { NextRequest, NextResponse } from "next/server";
import type { Prisma, Verdict } from "@prisma/client";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { tryAppendLedger } from "@/lib/ledger";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

const VERDICTS: Verdict[] = ["VERIFIED", "REVIEW", "FLAGGED"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;
    const category = searchParams.get("category") || undefined;
    const verdict = searchParams.get("verdict") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const where: Prisma.MediaAssetWhereInput = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (category && category !== "ALL") {
      where.manualCategory = { equals: category, mode: "insensitive" };
    }

    if (verdict === "UNVERIFIED") {
      where.OR = [{ integrity: null }, { integrity: { verdict: null } }];
    } else if (verdict && VERDICTS.includes(verdict as Verdict)) {
      where.integrity = { verdict: verdict as Verdict };
    }

    if (from || to) {
      const range: Prisma.DateTimeFilter = {};
      if (from) {
        range.gte = new Date(from);
      }
      if (to) {
        // Set to end of the day if it's just a date string like YYYY-MM-DD
        const toDate = new Date(to);
        if (to.length === 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        range.lte = toDate;
      }
      where.capturedAt = range;
    }

    const assets = await db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { integrity: { select: INTEGRITY_SUMMARY } },
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
      claimText,
      etag,
      phash,
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

    const actor = await getActor();

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
        claimText: claimText?.trim() || null,
        capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
        uploadedBy: actor.id,
        etag: typeof etag === "string" ? etag : null,
        phash: typeof phash === "string" ? phash : null,
        integrity: { create: {} },
      },
    });

    await tryAppendLedger({
      type: "ASSET_UPLOADED",
      actor: actor.label,
      assetId: asset.id,
      projectId,
      payload: {
        cloudinaryPublicId: asset.cloudinaryPublicId,
        secureUrl: asset.secureUrl,
        resourceType: asset.resourceType,
        bytes: asset.bytes,
        etag: asset.etag,
        phash: asset.phash,
        claimedCapturedAt: asset.capturedAt,
        claimedLocation: asset.manualLocation,
        category: asset.manualCategory,
      },
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/assets error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create media asset" },
      { status: 500 }
    );
  }
}
