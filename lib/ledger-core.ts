/**
 * Hash-chain primitives shared by the server (writing entries) and the browser
 * (independently re-verifying them on the public Verify page). Uses Web Crypto
 * only, so it runs unchanged in Node 18+ and in any modern browser.
 */

export const GENESIS_HASH = "0".repeat(64);

export interface LedgerEntryLike {
  seq: number;
  type: string;
  assetId: string | null;
  projectId: string | null;
  actor: string;
  payload: unknown;
  prevHash: string;
  entryHash: string;
  createdAt: string | Date;
}

/**
 * Deterministic JSON: object keys sorted recursively, undefined dropped.
 * Postgres jsonb reorders keys, so the hash must not depend on key order.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalJSON(v === undefined ? null : v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The exact content covered by an entry's hash (everything except the hashes). */
export function hashedContent(e: Omit<LedgerEntryLike, "prevHash" | "entryHash">) {
  return {
    seq: e.seq,
    type: e.type,
    assetId: e.assetId ?? null,
    projectId: e.projectId ?? null,
    actor: e.actor,
    payload: e.payload ?? null,
    createdAt: new Date(e.createdAt).toISOString(),
  };
}

export async function computeEntryHash(
  prevHash: string,
  e: Omit<LedgerEntryLike, "prevHash" | "entryHash">
): Promise<string> {
  return sha256Hex(prevHash + "|" + canonicalJSON(hashedContent(e)));
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  /** seq of the first entry whose stored hash doesn't match its content or link */
  brokenAtSeq: number | null;
  reason: string | null;
}

/**
 * Verify a contiguous run of entries (sorted by seq). When `fromGenesis` is true
 * the first entry must link to GENESIS_HASH.
 */
export async function verifyChain(
  entries: LedgerEntryLike[],
  fromGenesis = true
): Promise<ChainVerification> {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  let expectedPrev = fromGenesis ? GENESIS_HASH : sorted[0]?.prevHash;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (i > 0 && e.seq !== sorted[i - 1].seq + 1) {
      return { ok: false, checked: i, brokenAtSeq: e.seq, reason: `Gap in sequence before #${e.seq}` };
    }
    if (e.prevHash !== expectedPrev) {
      return { ok: false, checked: i, brokenAtSeq: e.seq, reason: `Entry #${e.seq} does not link to the previous entry` };
    }
    const recomputed = await computeEntryHash(e.prevHash, e);
    if (recomputed !== e.entryHash) {
      return { ok: false, checked: i, brokenAtSeq: e.seq, reason: `Entry #${e.seq} content was altered after it was written` };
    }
    expectedPrev = e.entryHash;
  }
  return { ok: true, checked: sorted.length, brokenAtSeq: null, reason: null };
}

/** Binary Merkle root over entry hashes (last node duplicated on odd levels). */
export async function merkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return GENESIS_HASH;
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(await sha256Hex(left + right));
    }
    level = next;
  }
  return level[0];
}
