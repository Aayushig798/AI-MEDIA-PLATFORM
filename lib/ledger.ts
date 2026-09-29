import { Prisma } from "@prisma/client";
import { prisma as db } from "@/lib/db";
import { GENESIS_HASH, computeEntryHash, merkleRoot, verifyChain } from "@/lib/ledger-core";

export type LedgerEventType =
  | "ASSET_UPLOADED"
  | "AI_TAGGED"
  | "EMBEDDED"
  | "USED_IN_COMPARISON"
  | "METADATA_EDITED"
  | "INTEGRITY_CHECKED"
  | "REVIEW_DECISION"
  | "DERIVATIVE_ISSUED"
  | "COMPARISON_CREATED"
  | "METRIC_MEASURED"
  | "REEL_RENDERED"
  | "REPORT_GENERATED"
  | "REPORT_EDITED"
  | "ASSET_DELETED"
  | "CLOUDINARY_NOTIFICATION"
  | "ANCHOR";

// Arbitrary constant: all appends serialize on this Postgres advisory lock so
// two concurrent writers can never claim the same seq / prevHash.
const LEDGER_LOCK_KEY = 7_331_001;

interface AppendInput {
  type: LedgerEventType;
  actor: string;
  assetId?: string | null;
  projectId?: string | null;
  payload: Record<string, unknown>;
}

export async function appendLedger(input: AppendInput) {
  // Round-trip through JSON so what we hash is exactly what jsonb will store.
  const payload = JSON.parse(JSON.stringify(input.payload ?? {}));

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LEDGER_LOCK_KEY})`;
    const last = await tx.ledgerEntry.findFirst({ orderBy: { seq: "desc" } });
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.entryHash ?? GENESIS_HASH;
    // Postgres timestamp(3) keeps milliseconds, so this survives the round trip.
    const createdAt = new Date();

    const base = {
      seq,
      type: input.type,
      assetId: input.assetId ?? null,
      projectId: input.projectId ?? null,
      actor: input.actor,
      payload,
      createdAt,
    };
    const entryHash = await computeEntryHash(prevHash, base);

    return tx.ledgerEntry.create({
      data: { ...base, payload: payload as Prisma.InputJsonValue, prevHash, entryHash },
    });
  });
}

/** Best-effort append: the ledger must never make a user-facing action fail. */
export async function tryAppendLedger(input: AppendInput) {
  try {
    return await appendLedger(input);
  } catch (err) {
    console.error(`[ledger] failed to append ${input.type}:`, err);
    return null;
  }
}

export async function verifyFullChain() {
  const entries = await db.ledgerEntry.findMany({ orderBy: { seq: "asc" } });
  const result = await verifyChain(entries);
  return { ...result, total: entries.length, head: entries.at(-1)?.entryHash ?? GENESIS_HASH };
}

/**
 * Anchor every entry written since the previous anchor under one Merkle root.
 * Publishing that root somewhere public (e.g. a commit to a public repo) makes
 * even a full-database rewrite detectable.
 */
export async function createAnchor(actor: string) {
  const lastAnchor = await db.merkleAnchor.findFirst({ orderBy: { toSeq: "desc" } });
  const fromSeq = (lastAnchor?.toSeq ?? 0) + 1;
  const entries = await db.ledgerEntry.findMany({
    where: { seq: { gte: fromSeq } },
    orderBy: { seq: "asc" },
  });
  if (entries.length === 0) return null;

  const root = await merkleRoot(entries.map((e) => e.entryHash));
  const toSeq = entries[entries.length - 1].seq;
  const anchor = await db.merkleAnchor.create({
    data: { fromSeq, toSeq, entryCount: entries.length, root },
  });
  await appendLedger({
    type: "ANCHOR",
    actor,
    payload: { anchorId: anchor.id, fromSeq, toSeq, entryCount: entries.length, root },
  });
  return anchor;
}
