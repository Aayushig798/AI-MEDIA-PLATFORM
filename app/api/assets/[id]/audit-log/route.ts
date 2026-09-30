import { NextRequest, NextResponse } from "next/server";
import { db, prisma } from "@/lib/db";
import { verifyFullChain } from "@/lib/ledger";

// Ledger event types that are NOT already mirrored from AssetAuditLog
const LEDGER_ONLY = [
  "INTEGRITY_CHECKED",
  "REVIEW_DECISION",
  "DERIVATIVE_ISSUED",
  "METRIC_MEASURED",
  "REEL_RENDERED",
  "METADATA_EDITED",
  "CLOUDINARY_NOTIFICATION",
];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assetId = params.id;
    if (!assetId) {
      return NextResponse.json(
        { success: false, error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Asset, audit rows and the ledger side all load in parallel
    const [asset, auditLogs, ledgerSide] = await Promise.all([
      db.mediaAsset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          cloudinaryPublicId: true,
          secureUrl: true,
          resourceType: true,
          format: true,
          manualCategory: true,
          manualLocation: true,
          capturedAt: true,
          createdAt: true,
        },
      }),
      db.assetAuditLog.findMany({
        where: { mediaAssetId: assetId },
        orderBy: { createdAt: "asc" },
      }),
      Promise.all([
        prisma.ledgerEntry.findMany({
          where: { assetId, type: { in: LEDGER_ONLY } },
          orderBy: { seq: "asc" },
        }),
        verifyFullChain(),
        prisma.ledgerEntry.count({ where: { assetId } }),
      ]).catch(() => null), // file-store mode: audit log only
    ]);

    if (!asset) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    // Integrity Engine events live only in the hash-chained ledger; merge them in.
    let ledger: { chainIntact: boolean; entries: number } | null = null;
    let ledgerLogs: any[] = [];
    if (ledgerSide) {
      const [entries, chain, count] = ledgerSide;
      ledgerLogs = entries.map((e) => ({
        id: e.id,
        mediaAssetId: assetId,
        eventType: e.type.toLowerCase(),
        eventDetail: { ...(e.payload as object), ledgerSeq: e.seq, entryHash: e.entryHash },
        actor: e.actor,
        createdAt: e.createdAt,
      }));
      ledger = { chainIntact: chain.ok, entries: count };
    }

    const logs = [...auditLogs, ...ledgerLogs].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      asset,
      count: logs.length,
      logs,
      ledger,
    });
  } catch (error: any) {
    console.error("GET /api/assets/[id]/audit-log error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch asset audit log" },
      { status: 500 }
    );
  }
}
