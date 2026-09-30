"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link2, Anchor, Loader2 } from "lucide-react";
import { ChainVerifier } from "@/components/ChainVerifier";

function LedgerExplorer() {
  const projectId = useSearchParams().get("projectId") ?? undefined;
  const [anchoring, setAnchoring] = useState(false);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  const anchor = async () => {
    setAnchoring(true);
    const res = await fetch("/api/ledger/anchor", { method: "POST" });
    const data = await res.json();
    setMessage(
      data.anchor
        ? `Anchored entries #${data.anchor.fromSeq}–#${data.anchor.toSeq} under root ${data.anchor.root}. Publish this root (e.g. commit it to a public repo) to make even a full rewrite detectable.`
        : data.message || data.error
    );
    setAnchoring(false);
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <Link2 className="w-4 h-4" /> Traceability
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Evidence ledger</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Every upload, check, review, derivative, comparison, reel and report is an append-only entry whose SHA-256 covers the
            previous entry. Derivatives are labelled with Cloudinary&apos;s Content Credentials vocabulary: <b>transcoded</b> (still
            evidence) or <b>edited</b> (illustrative).
          </p>
        </div>
        <button
          type="button"
          onClick={anchor}
          disabled={anchoring}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50"
        >
          {anchoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Anchor className="w-4 h-4" />}
          Seal new entries (Merkle anchor)
        </button>
      </div>
      {message && <p className="text-xs text-slate-300 font-mono break-all glass-panel rounded-xl p-3">{message}</p>}
      <ChainVerifier key={version} projectId={projectId} title={projectId ? "Entries for this project" : "Full chain"} />
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense>
      <LedgerExplorer />
    </Suspense>
  );
}
