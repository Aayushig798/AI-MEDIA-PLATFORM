import { db } from "@/lib/db";

export type AuditEventType =
  | "uploaded"
  | "ai_tagged"
  | "embedded"
  | "used_in_comparison"
  | "used_in_report";

export async function logEvent(
  mediaAssetId: string,
  eventType: AuditEventType,
  eventDetail: Record<string, unknown>,
  actor: string = "system"
) {
  try {
    if (!mediaAssetId) return;
    await db.assetAuditLog.create({
      data: {
        mediaAssetId,
        eventType,
        eventDetail: eventDetail || {},
        actor: actor || "system",
      },
    });
  } catch (err) {
    console.error(`[AuditLog Error] Failed to log ${eventType} for asset ${mediaAssetId}:`, err);
  }
}
