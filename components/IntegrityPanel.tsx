"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint, Loader2, RefreshCw, ShieldCheck, ExternalLink, Save } from "lucide-react";
import { TrustBadge, IntegritySummary } from "./TrustBadge";
import { CheckList, CheckResultView } from "./CheckList";

interface FullIntegrity extends IntegritySummary {
  checks: CheckResultView[];
  error?: string | null;
  reviewNote?: string | null;
  reviewedBy?: string | null;
}

/** Proof-of-Impact panel for the asset inspector: verify, see why, set the claim. */
export function IntegrityPanel({
  assetId,
  initial,
  initialClaim,
  onVerified,
}: {
  assetId: string;
  initial?: IntegritySummary | null;
  initialClaim?: string | null;
  onVerified?: (integrity: IntegritySummary) => void;
}) {
  const [integrity, setIntegrity] = useState<FullIntegrity | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [claim, setClaim] = useState(initialClaim ?? "");
  const [savedClaim, setSavedClaim] = useState(initialClaim ?? "");
  const [savingClaim, setSavingClaim] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/assets/${assetId}/integrity`);
    const data = await res.json();
    if (data.success) {
      setIntegrity(data.integrity);
      setClaim(data.claimText ?? "");
      setSavedClaim(data.claimText ?? "");
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async () => {
    try {
      setVerifying(true);
      setError("");
      const res = await fetch(`/api/assets/${assetId}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Verification failed");
      setIntegrity(data.integrity);
      onVerified?.(data.integrity);
    } catch (e: any) {
      setError(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const saveClaim = async () => {
    setSavingClaim(true);
    setError("");
    const res = await fetch(`/api/assets/${assetId}/claim`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimText: claim }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) setError(data.error || "Failed to save claim");
    else {
      setSavedClaim(claim);
      load();
    }
    setSavingClaim(false);
  };

  const shown = integrity ?? initial ?? null;
  const done = integrity?.status === "DONE";

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-3 text-xs border border-emerald-500/20">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
          Proof-of-Impact Integrity
        </h3>
        <TrustBadge integrity={shown} size="lg" />
      </div>

      {error && <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">{error}</div>}
      {integrity?.status === "ERROR" && integrity.error && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">{integrity.error}</div>
      )}

      {done && integrity.checks?.length > 0 ? (
        <CheckList checks={integrity.checks} compact />
      ) : (
        <p className="text-slate-400">
          Runs 9 checks: duplicates, recycled-image pHash, web copies, EXIF, geofence, weather, satellite, AI claim match and
          provenance.
        </p>
      )}

      {integrity?.reviewDecision && (
        <p className="text-[11px] text-slate-400">
          Human review: <span className="font-semibold text-slate-200">{integrity.reviewDecision.toLowerCase()}</span>
          {integrity.reviewedBy ? ` by ${integrity.reviewedBy}` : ""}
          {integrity.reviewNote ? ` — “${integrity.reviewNote}”` : ""}
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Claim this photo proves (optional; else the project claim)"
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
        />
        {claim !== savedClaim && (
          <button
            type="button"
            onClick={saveClaim}
            disabled={savingClaim}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-100 disabled:opacity-50"
          >
            {savingClaim ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          id="verify-asset-btn"
          onClick={verify}
          disabled={verifying}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition"
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <RefreshCw className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          <span>{verifying ? "Running checks..." : done ? "Re-run verification" : "Submit for verification"}</span>
        </button>
        <Link
          href={`/verify/${assetId}`}
          target="_blank"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Public page
        </Link>
      </div>
    </div>
  );
}
