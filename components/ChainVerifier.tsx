"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, ShieldX, Loader2, Hash, Anchor, RefreshCw } from "lucide-react";
import { verifyChain, merkleRoot, ChainVerification, LedgerEntryLike } from "@/lib/ledger-core";

interface Entry extends LedgerEntryLike {
  id: string;
}
interface AnchorRow {
  id: string;
  externalRef?: string | null;
  fromSeq: number;
  toSeq: number;
  entryCount: number;
  root: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  ASSET_UPLOADED: "Uploaded",
  AI_TAGGED: "AI tagged",
  EMBEDDED: "Embedded for search",
  USED_IN_COMPARISON: "Used in comparison",
  METADATA_EDITED: "Metadata edited",
  INTEGRITY_CHECKED: "Integrity checked",
  REVIEW_DECISION: "Human review",
  DERIVATIVE_ISSUED: "Derivative issued",
  COMPARISON_CREATED: "Comparison created",
  METRIC_MEASURED: "Change measured",
  REEL_RENDERED: "Reel rendered",
  REPORT_GENERATED: "Used in report",
  REPORT_EDITED: "Report edited",
  ASSET_DELETED: "Deleted",
  CLOUDINARY_NOTIFICATION: "Cloudinary webhook",
  ANCHOR: "Merkle anchor",
};

function short(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function describe(e: Entry): string {
  const p = (e.payload ?? {}) as Record<string, any>;
  switch (e.type) {
    case "INTEGRITY_CHECKED":
      return `Trust ${p.trustScore} · ${p.verdict}`;
    case "REVIEW_DECISION":
      return `${String(p.decision).toLowerCase()}${p.note ? ` — ${p.note}` : ""}`;
    case "DERIVATIVE_ISSUED":
      return `${p.class === "TRANSCODED" ? "transcoded (evidence)" : "edited (illustrative)"} · ${p.transformation}`;
    case "METRIC_MEASURED":
      return `${p.metric}: ${p.beforePct}% → ${p.afterPct}% (${p.deltaPp > 0 ? "+" : ""}${p.deltaPp} pp)`;
    case "METADATA_EDITED":
      return Object.keys(p.changes ?? {}).join(", ");
    case "ANCHOR":
      return `#${p.fromSeq}–#${p.toSeq} root ${short(String(p.root))}`;
    case "ASSET_UPLOADED":
      return `${p.resourceType}${p.phash ? ` · pHash ${p.phash}` : ""}`;
    default:
      return "";
  }
}

/**
 * Re-verifies the whole ledger in the viewer's browser with Web Crypto:
 * every entry hash, every link, and every published Merkle anchor.
 */
export function ChainVerifier({ assetId, projectId, title = "Tamper-evident ledger" }: { assetId?: string; projectId?: string; title?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [anchors, setAnchors] = useState<{ anchor: AnchorRow; ok: boolean }[]>([]);
  const [result, setResult] = useState<ChainVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      // Page through the whole chain (5,000 entries per request)
      const all: Entry[] = [];
      for (let afterSeq = 0; ; ) {
        const ledgerRes = await fetch(`/api/ledger?limit=5000&afterSeq=${afterSeq}`);
        const ledger = await ledgerRes.json();
        if (!ledger.success) throw new Error(ledger.error);
        all.push(...ledger.entries);
        if (ledger.entries.length < 5000) break;
        afterSeq = ledger.entries[ledger.entries.length - 1].seq;
      }
      const anchorJson = await (await fetch("/api/ledger/anchor")).json();

      setResult(await verifyChain(all));
      setEntries(all);

      const checkedAnchors = await Promise.all(
        (anchorJson.anchors ?? []).map(async (a: AnchorRow) => {
          const leaves = all.filter((e) => e.seq >= a.fromSeq && e.seq <= a.toSeq).map((e) => e.entryHash);
          return { anchor: a, ok: leaves.length === a.entryCount && (await merkleRoot(leaves)) === a.root };
        })
      );
      setAnchors(checkedAnchors);
    } catch (err: any) {
      setError(err.message || "Could not load ledger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const shown = entries
    .filter((e) => (assetId ? e.assetId === assetId : projectId ? e.projectId === projectId : true))
    .sort((a, b) => b.seq - a.seq);

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Hash className="w-4 h-4 text-emerald-400" /> {title}
        </h3>
        <button
          type="button"
          id="recompute-chain-btn"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Recompute hashes in your browser
        </button>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {result && !loading && (
        <div
          className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
            result.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-rose-500/10 border-rose-500/40 text-rose-200"
          }`}
        >
          {result.ok ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <ShieldX className="w-5 h-5 shrink-0" />}
          <div>
            <p className="font-bold">
              {result.ok ? `Chain intact: all ${result.checked} entries re-hashed in this browser` : `Chain BROKEN at entry #${result.brokenAtSeq}`}
            </p>
            <p className="opacity-80">
              {result.ok
                ? "Each entry's SHA-256 covers its content and the previous entry's hash, so editing any past row breaks every hash after it."
                : result.reason}
            </p>
          </div>
        </div>
      )}

      {anchors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5" /> Merkle anchors
          </p>
          {anchors.slice(0, 3).map(({ anchor, ok }) => (
            <p key={anchor.id} className="text-[11px] font-mono text-slate-300">
              <span className={ok ? "text-emerald-400" : "text-rose-400"}>{ok ? "✓" : "✗"}</span> #{anchor.fromSeq}–#{anchor.toSeq} ·{" "}
              {short(anchor.root)} · {new Date(anchor.createdAt).toLocaleString()}
              {anchor.externalRef && (
                <>
                  {" · "}
                  <a href={anchor.externalRef} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">
                    published
                  </a>
                </>
              )}
            </p>
          ))}
        </div>
      )}

      <ol className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {shown.map((e) => {
          const broken = result && !result.ok && result.brokenAtSeq !== null && e.seq >= result.brokenAtSeq;
          return (
            <li
              key={e.id}
              className={`grid grid-cols-[auto_1fr] gap-x-3 p-2.5 rounded-xl border text-[11px] ${
                broken ? "border-rose-500/40 bg-rose-500/5" : "border-white/5 bg-slate-900/50"
              }`}
            >
              <span className="font-mono font-bold text-slate-400">#{e.seq}</span>
              <div className="min-w-0">
                <p className="text-slate-200">
                  <span className="font-semibold">{TYPE_LABELS[e.type] ?? e.type}</span>
                  {describe(e) && <span className="text-slate-400"> · {describe(e)}</span>}
                </p>
                <p className="text-slate-500 truncate">
                  {new Date(e.createdAt).toLocaleString()} · {e.actor}
                </p>
                <p className="font-mono text-slate-500 truncate" title={e.entryHash}>
                  hash {short(e.entryHash)} ← prev {short(e.prevHash)}
                </p>
              </div>
            </li>
          );
        })}
        {!loading && shown.length === 0 && <li className="text-xs text-slate-500">No ledger entries yet.</li>}
      </ol>
    </div>
  );
}
