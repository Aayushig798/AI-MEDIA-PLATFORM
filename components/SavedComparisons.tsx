"use client";

import { useState, useEffect } from "react";
import { 
  Layers, 
  Trash2, 
  Calendar, 
  MapPin, 
  SlidersHorizontal, 
  Loader2, 
  Maximize2, 
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { CompareSlider } from "./CompareSlider";

export interface SavedComparisonItem {
  id: string;
  projectId: string;
  beforeAssetId: string;
  afterAssetId: string;
  notes?: string | null;
  verified?: boolean;
  matchConfidence?: number | null;
  aiReason?: string | null;
  changeSummary?: string | null;
  createdBy: string;
  createdAt: string;
  beforeAsset?: any;
  afterAsset?: any;
}

interface SavedComparisonsProps {
  projectId?: string;
  refreshTrigger?: number;
}

export function SavedComparisons({
  projectId,
  refreshTrigger = 0,
}: SavedComparisonsProps) {
  const [comparisons, setComparisons] = useState<SavedComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [expandedComp, setExpandedComp] = useState<SavedComparisonItem | null>(null);

  const fetchComparisons = async () => {
    try {
      setLoading(true);
      setError("");
      const url = projectId
        ? `/api/comparisons?projectId=${encodeURIComponent(projectId)}`
        : "/api/comparisons";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load saved comparisons");
      }
      setComparisons(data.comparisons || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch comparisons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisons();
  }, [projectId, refreshTrigger]);

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/comparisons/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete comparison");
      }
      setComparisons((prev) => prev.filter((c) => c.id !== id));
      if (expandedComp?.id === id) {
        setExpandedComp(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete comparison");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        <span className="text-xs">Loading saved comparisons...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
        {error}
      </div>
    );
  }

  if (comparisons.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-8 text-center">
        <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-slate-200">No Saved Comparisons Yet</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
          Use the Suggested Comparisons section above or the Search page to compare before/after visual evidence and save verified change pairs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">
            Saved Evidence Comparisons ({comparisons.length})
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Permanent verified temporal change evidence
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {comparisons.map((comp) => {
          if (!comp.beforeAsset || !comp.afterAsset) return null;

          const pct = Math.round((comp.matchConfidence ?? 0.85) * 100);

          return (
            <div
              key={comp.id}
              className="glass-card rounded-2xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      {comp.beforeAsset.manualLocation || comp.afterAsset.manualLocation || "Project Location"}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Saved {new Date(comp.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedComp(comp)}
                      title="Expand full view"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(comp.id)}
                      disabled={deletingId === comp.id}
                      title="Delete comparison"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                    >
                      {deletingId === comp.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Verification Badge */}
                <div>
                  {comp.verified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      AI-verified same scene ({pct}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Unverified
                    </span>
                  )}
                </div>

                {/* Embedded Interactive Slider */}
                <CompareSlider
                  beforeUrl={comp.beforeAsset.normalizedUrl || comp.beforeAsset.secureUrl}
                  afterUrl={comp.afterAsset.normalizedUrl || comp.afterAsset.secureUrl}
                  beforeDate={comp.beforeAsset.capturedAt}
                  afterDate={comp.afterAsset.capturedAt}
                  aspectRatio="aspect-[16/10]"
                />

                {/* AI Reason & Visible Change Summary */}
                {(comp.aiReason || comp.changeSummary) && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-white/5 text-xs">
                    {comp.aiReason && (
                      <div className="flex items-start gap-1.5 text-slate-300">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                            AI Verification
                          </span>
                          <span className="leading-relaxed">{comp.aiReason}</span>
                        </div>
                      </div>
                    )}
                    {comp.changeSummary && (
                      <div className="flex items-start gap-1.5 text-emerald-300/90 pt-1 border-t border-white/5">
                        <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-teal-400 text-[10px] uppercase tracking-wider block">
                            Visible Change
                          </span>
                          <span className="leading-relaxed">{comp.changeSummary}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {comp.notes && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300 italic flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>&ldquo;{comp.notes}&rdquo;</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Modal */}
      {expandedComp && expandedComp.beforeAsset && expandedComp.afterAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in">
          <div
            className="glass-dropdown w-full max-w-5xl max-h-[94vh] rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-white/10 overflow-y-auto flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    Full-Screen Evidence Comparison
                  </h3>
                  {expandedComp.verified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      AI-verified same scene ({Math.round((expandedComp.matchConfidence ?? 0.85) * 100)}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Unverified
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {expandedComp.beforeAsset.manualLocation || "Project Location"} &bull; Saved {new Date(expandedComp.createdAt).toLocaleDateString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExpandedComp(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CompareSlider
              beforeUrl={expandedComp.beforeAsset.normalizedUrl || expandedComp.beforeAsset.secureUrl}
              afterUrl={expandedComp.afterAsset.normalizedUrl || expandedComp.afterAsset.secureUrl}
              beforeDate={expandedComp.beforeAsset.capturedAt}
              afterDate={expandedComp.afterAsset.capturedAt}
              aspectRatio="aspect-[16/9]"
              notes={expandedComp.notes}
            />

            {(expandedComp.aiReason || expandedComp.changeSummary) && (
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-white/5 text-xs">
                {expandedComp.aiReason && (
                  <div className="flex items-start gap-2 text-slate-300">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                        AI Scene Verification Analysis
                      </span>
                      <span className="leading-relaxed">{expandedComp.aiReason}</span>
                    </div>
                  </div>
                )}
                {expandedComp.changeSummary && (
                  <div className="flex items-start gap-2 text-emerald-300/90 pt-2 border-t border-white/5">
                    <Layers className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-teal-400 text-[10px] uppercase tracking-wider block">
                        Temporal & Physical Changes
                      </span>
                      <span className="leading-relaxed">{expandedComp.changeSummary}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setExpandedComp(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
