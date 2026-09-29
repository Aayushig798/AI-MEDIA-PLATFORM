import { prisma } from "@/lib/db";
import { tryAppendLedger } from "@/lib/ledger";
import { generateEmbeddingForAsset } from "@/lib/ai/embeddings";

const TRACKED = ["manualCategory", "categorySource", "manualLocation", "manualNotes", "capturedAt"] as const;
// The integrity checks compare against these, so a change re-opens verification.
const EVIDENCE_FIELDS = new Set(["capturedAt", "manualNotes"]);
// These feed the semantic-search embedding text.
const EMBEDDED_FIELDS = new Set(["manualCategory", "manualLocation", "manualNotes"]);

type Snapshot = Partial<Record<(typeof TRACKED)[number], unknown>> & { id: string; projectId: string };

function same(a: unknown, b: unknown) {
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toISOString() : v ?? null);
  return norm(a) === norm(b);
}

/** Ledger a metadata edit, invalidate a stale verdict, and refresh the search embedding. */
export async function recordMetadataEdit(before: Snapshot, after: Snapshot, actor: string) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of TRACKED) {
    if (!same(before[field], after[field])) changes[field] = { from: before[field] ?? null, to: after[field] ?? null };
  }
  const changed = Object.keys(changes);
  if (changed.length === 0) return;

  await tryAppendLedger({
    type: "METADATA_EDITED",
    actor,
    assetId: before.id,
    projectId: before.projectId,
    payload: { changes },
  });

  if (changed.some((f) => EVIDENCE_FIELDS.has(f))) {
    await prisma.assetIntegrity.updateMany({ where: { assetId: before.id, status: "DONE" }, data: { status: "PENDING" } }).catch(() => null);
  }
  if (changed.some((f) => EMBEDDED_FIELDS.has(f))) {
    generateEmbeddingForAsset(before.id).catch((err) => console.warn("[embeddings] refresh after edit failed:", err?.message || err));
  }
}

/**
 * Before deleting an asset row: drop records that reference it without a foreign
 * key, and ledger the deletion (the ledger keeps the asset's history).
 */
export async function recordAssetDeletion(
  asset: { id: string; projectId: string; cloudinaryPublicId: string },
  actor: string
) {
  try {
    await prisma.comparison.deleteMany({ where: { OR: [{ beforeAssetId: asset.id }, { afterAssetId: asset.id }] } });
    await prisma.phashMatch.deleteMany({ where: { matchAssetId: asset.id } });
  } catch (err) {
    console.warn("[asset-history] cleanup skipped:", (err as Error).message);
  }
  const sha = await prisma.mediaAsset
    .findUnique({ where: { id: asset.id }, select: { sha256: true } })
    .then((a) => a?.sha256 ?? null)
    .catch(() => null);
  await tryAppendLedger({
    type: "ASSET_DELETED",
    actor,
    assetId: asset.id,
    projectId: asset.projectId,
    payload: { cloudinaryPublicId: asset.cloudinaryPublicId, sha256: sha },
  });
}
