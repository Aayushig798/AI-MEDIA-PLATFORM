"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Loader2, Copy, Check, ExternalLink } from "lucide-react";

interface Reel {
  id: string;
  aspect: string;
  deliveryUrl: string;
  createdAt: string;
}

/** Cloudinary renders the spliced video on first request / eagerly; poll until it's ready. */
function ReelPlayer({ reel }: { reel: Reel }) {
  const [ready, setReady] = useState(false);
  const [waited, setWaited] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      while (!cancelled && tries < 60) {
        tries++;
        const res = await fetch(reel.deliveryUrl, { method: "HEAD" }).catch(() => null);
        if (res?.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        if (!cancelled) setWaited(tries * 5);
        await new Promise((r) => setTimeout(r, 5000));
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [reel.deliveryUrl]);

  return (
    <div className="space-y-2">
      <div className={`${reel.aspect === "9:16" ? "aspect-[9/16] max-w-[260px]" : "aspect-square max-w-[320px]"} w-full rounded-xl bg-black border border-white/10 overflow-hidden flex items-center justify-center`}>
        {ready ? (
          <video src={reel.deliveryUrl} controls playsInline className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-[11px] text-slate-400 p-4">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
            Cloudinary is rendering the reel{waited ? ` (${waited}s)` : ""}…
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-semibold text-slate-300">{reel.aspect}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(reel.deliveryUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} one URL
        </button>
        <a href={reel.deliveryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-400 hover:text-white">
          <ExternalLink className="w-3 h-3" /> open
        </a>
      </div>
    </div>
  );
}

export function ReelPanel({ comparisonId, reels: initial, hasMetric }: { comparisonId: string; reels: Reel[]; hasMetric: boolean }) {
  const [reels, setReels] = useState<Reel[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => setReels(initial), [initial]);

  const make = async (aspect: "9:16" | "1:1") => {
    try {
      setBusy(aspect);
      setError("");
      const res = await fetch(`/api/comparisons/${comparisonId}/reel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspect }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to build reel");
      setReels((prev) => [data.reel, ...prev]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const latest = ["9:16", "1:1"].map((a) => reels.find((r) => r.aspect === a)).filter(Boolean) as Reel[];

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-cyan-300" /> Donor reel
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Title card → before → after → measured change → field clips → QR to the Verify page. One Cloudinary URL, no video editor.
            {!hasMetric && " Save a measurement first to include the change card."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["9:16", "1:1"] as const).map((aspect) => (
            <button
              key={aspect}
              type="button"
              onClick={() => make(aspect)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 disabled:opacity-50"
            >
              {busy === aspect ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clapperboard className="w-3.5 h-3.5" />}
              Make {aspect} reel
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {latest.length > 0 && (
        <div className="flex flex-wrap gap-6">
          {latest.map((r) => (
            <ReelPlayer key={r.id} reel={r} />
          ))}
        </div>
      )}
    </div>
  );
}
