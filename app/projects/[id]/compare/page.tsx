"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Columns2, Loader2, Sparkles, Plus, ArrowRight } from "lucide-react";
import { getThumbnailUrl } from "@/lib/cloudinary-url";
import { TrustBadge, IntegritySummary } from "@/components/TrustBadge";

interface AssetLite {
  id: string;
  secureUrl: string;
  resourceType: string;
  capturedAt: string | null;
  manualLocation: string | null;
  integrity?: IntegritySummary | null;
}
interface Suggestion {
  before: AssetLite;
  after: AssetLite;
  gapDays: number;
  location: string | null;
  savedComparisonId: string | null;
}
interface ComparisonRow {
  id: string;
  beforeAssetId: string;
  afterAssetId: string;
  createdAt: string;
  metrics: { metric: string; beforePct: number; afterPct: number; deltaPp: number }[];
}

function Thumb({ asset }: { asset?: AssetLite }) {
  if (!asset) return <div className="w-full aspect-square rounded-lg bg-slate-900" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={getThumbnailUrl(asset.secureUrl, asset.resourceType)} alt="" className="w-full aspect-square object-cover rounded-lg border border-white/10" />
  );
}

export default function ComparePairsPage() {
  const projectId = useParams().id as string;
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [images, setImages] = useState<AssetLite[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState({ before: "", after: "" });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, c] = await Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/suggested-comparisons`).then((r) => r.json()),
      fetch(`/api/comparisons?projectId=${projectId}`).then((r) => r.json()),
    ]);
    if (p.success) {
      setProjectName(p.project.name);
      setImages(p.project.assets.filter((a: AssetLite) => a.resourceType === "image"));
    }
    if (s.success) setSuggestions(s.suggestions);
    if (c.success) setComparisons(c.comparisons);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (beforeAssetId: string, afterAssetId: string) => {
    try {
      setCreating(true);
      setError("");
      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, beforeAssetId, afterAssetId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create comparison");
      router.push(`/projects/${projectId}/compare/${data.comparison.id}`);
    } catch (e: any) {
      setError(e.message);
      setCreating(false);
    }
  };

  const byId = Object.fromEntries(images.map((a) => [a.id, a]));
  const sortedImages = [...images].sort((a, b) => (a.capturedAt ?? "").localeCompare(b.capturedAt ?? ""));

  return (
    <div className="space-y-8 animate-fade-in">
      <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4 text-emerald-400" /> Back to {projectName || "project"}
      </Link>
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 uppercase tracking-wider">
          <Columns2 className="w-4 h-4" /> Before / after evidence
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Compare, measure &amp; make a reel</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Pairs are suggested from photos of the same spot (GPS within 150 m or the same location label) at least a week apart. Flagged
          or rejected photos never pair.
        </p>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" /> Suggested pairs
            </h2>
            {suggestions.length === 0 ? (
              <p className="text-xs text-slate-500">No same-spot photo pairs yet. Upload a later photo of the same location, or build one below.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.map((s) => (
                  <div key={s.before.id + s.after.id} className="glass-panel rounded-2xl p-4 border border-white/5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[s.before, s.after].map((a, i) => (
                        <div key={a.id} className="space-y-1">
                          <Thumb asset={a} />
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{i === 0 ? "Before" : "After"} · {a.capturedAt?.slice(0, 10)}</span>
                            <TrustBadge integrity={a.integrity} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {s.location} · {s.gapDays} days apart
                      </span>
                      {s.savedComparisonId ? (
                        <Link href={`/projects/${projectId}/compare/${s.savedComparisonId}`} className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                          Open <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => create(s.before.id, s.after.id)}
                          disabled={creating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" /> Confirm pair
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-white">Saved comparisons</h2>
            {comparisons.length === 0 ? (
              <p className="text-xs text-slate-500">None yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {comparisons.map((c) => {
                  const m = c.metrics[0];
                  return (
                    <Link key={c.id} href={`/projects/${projectId}/compare/${c.id}`} className="glass-card rounded-2xl p-3 border border-white/5 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Thumb asset={byId[c.beforeAssetId]} />
                        <Thumb asset={byId[c.afterAssetId]} />
                      </div>
                      <p className="text-xs text-slate-300">
                        {m ? (
                          <>
                            {m.metric === "GREEN_COVER" ? "Green cover" : "Water area"} {m.beforePct}% → {m.afterPct}%{" "}
                            <span className={m.deltaPp >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              ({m.deltaPp > 0 ? "+" : ""}
                              {m.deltaPp} pp)
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">Not measured yet</span>
                        )}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass-panel rounded-2xl p-4 border border-white/5 space-y-3">
            <h2 className="text-sm font-bold text-white">Build a pair manually</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {(["before", "after"] as const).map((role) => (
                <label key={role} className="space-y-1">
                  <span className="text-slate-400 capitalize">{role} photo</span>
                  <select
                    value={pick[role]}
                    onChange={(e) => setPick({ ...pick, [role]: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100"
                  >
                    <option value="">Choose…</option>
                    {sortedImages.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.capturedAt?.slice(0, 10) ?? "undated"} · {a.manualLocation ?? a.id}
                        {a.integrity?.verdict ? ` · ${a.integrity.verdict.toLowerCase()} ${a.integrity.trustScore}` : " · unverified"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!pick.before || !pick.after || creating}
                  onClick={() => create(pick.before, pick.after)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Create comparison
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
