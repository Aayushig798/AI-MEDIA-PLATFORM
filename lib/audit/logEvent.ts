import { db } from "@/lib/db";
import { tryAppendLedger, LedgerEventType } from "@/lib/ledger";

export type AuditEventType =
  | "uploaded"
  | "ai_tagged"
  | "embedded"
  | "used_in_comparison"
  | "used_in_report";

const LEDGER_TYPES: Record<AuditEventType, LedgerEventType> = {
  uploaded: "ASSET_UPLOADED",
  ai_tagged: "AI_TAGGED",
  embedded: "EMBEDDED",
  used_in_comparison: "USED_IN_COMPARISON",
  used_in_report: "REPORT_GENERATED",
};

export async function logEvent(
  mediaAssetId: string,
  eventType: AuditEventType,
  eventDetail: Record<string, unknown>,
  actor: string = "system"
) {
  if (!mediaAssetId) return;
  // The audit row and the asset's projectId (needed for the ledger entry) are fetched together
  const [, asset] = await Promise.all([
    db.assetAuditLog
      .create({
        data: {
          mediaAssetId,
          eventType,
          eventDetail: eventDetail || {},
          actor: actor || "system",
        },
      })
      .catch((err: unknown) => {
        console.error(`[AuditLog Error] Failed to log ${eventType} for asset ${mediaAssetId}:`, err);
      }),
    db.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { projectId: true } }).catch(() => null),
  ]);

  // Mirror into the tamper-evident hash chain (PostgreSQL only; best effort).
  await tryAppendLedger({
    type: LEDGER_TYPES[eventType],
    actor: actor || "system",
    assetId: mediaAssetId,
    projectId: (asset as { projectId?: string } | null)?.projectId ?? null,
    payload: { auditEvent: eventType, ...(eventDetail || {}) },
  });
}
