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
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Edit2,
  Brush
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

  // Full-screen modal
  const [expandedComp, setExpandedComp] = useState<SavedComparisonItem | null>(null);

  // AI Details Accordion Map (collapsed by default)
  const [expandedDetailsMap, setExpandedDetailsMap] = useState<Record<string, boolean>>({});

  // Caption Editing State
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionInput, setCaptionInput] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);

  // Cleanup Unverified Modal State
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupFeedback, setCleanupFeedback] = useState("");

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

  const toggleDetails = (id: string) => {
    setExpandedDetailsMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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

  const handleSaveCaption = async (id: string) => {
    try {
      setSavingCaption(true);
      const cleanVal = captionInput.trim();
      const res = await fetch(`/api/comparisons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: cleanVal || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save caption");
      }
      setComparisons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, notes: cleanVal || null } : c))
      );
      setEditingCaptionId(null);
      setCaptionInput("");
    } catch (err: any) {
      alert(err.message || "Failed to save caption");
    } finally {
      setSavingCaption(false);
    }
  };

  const handleConfirmCleanup = async () => {
    try {
      setCleaningUp(true);
      setCleanupFeedback("");
      const res = await fetch("/api/comparisons/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Cleanup failed");
      }
      const deletedSet = new Set<string>(data.deletedIds || []);
      setComparisons((prev) => prev.filter((c) => !deletedSet.has(c.id)));
      setCleanupFeedback(data.message || `Cleaned up ${data.count} unverified comparisons.`);
      setTimeout(() => {
        setShowCleanupModal(false);
        setCleanupFeedback("");
      }, 2000);
    } catch (err: any) {
      alert(err.message || "Failed to clean up unverified comparisons");
    } finally {
      setCleaningUp(false);
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

  // Count unverified low-confidence comparisons
  const unverifiedLowConfCount = comparisons.filter(
    (c) => c.verified === false && typeof c.matchConfidence === "number" && c.matchConfidence < 0.3
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">
            Saved Evidence Comparisons ({comparisons.length})
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {comparisons.length > 0 && (
            <button
              type="button"
              id="cleanup-unverified-comparisons-btn"
              onClick={() => setShowCleanupModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 transition"
              title="Delete unverified comparisons with confidence < 0.3"
            >
              <Brush className="w-3.5 h-3.5 text-amber-400" />
              <span>Clean up unverified comparisons</span>
              {unverifiedLowConfCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  {unverifiedLowConfCount}
                </span>
              )}
            </button>
          )}
          <span className="text-xs text-slate-400 hidden sm:inline">
            Permanent verified temporal change evidence
          </span>
        </div>
      </div>

      {comparisons.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-8 text-center">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-200">No Saved Comparisons Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            Use the Suggested Comparisons section above or the Search page to compare before/after visual evidence and save verified change pairs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {comparisons.map((comp) => {
            if (!comp.beforeAsset || !comp.afterAsset) return null;

            const pct = Math.round((comp.matchConfidence ?? 0.85) * 100);
            const isDetailsExpanded = Boolean(expandedDetailsMap[comp.id]);

            // Filter out default placeholder caption
            const hasRealCaption =
              comp.notes &&
              comp.notes.trim() !== "" &&
              comp.notes !== "Verification test comparison";

            return (
              <div
                key={comp.id}
                id={`saved-comp-${comp.id}`}
                className="glass-card rounded-2xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between group space-y-3"
              >
                {/* 1. TOP HIERARCHY: Photo Dates and Location */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {comp.beforeAsset.manualLocation || comp.afterAsset.manualLocation || "Project Location"}
                      </span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="text-slate-300">
                          {comp.beforeAsset.capturedAt
                            ? new Date(comp.beforeAsset.capturedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : "Earlier"}
                        </span>
                        <span className="text-slate-500">&rarr;</span>
                        <span className="text-slate-300">
                          {comp.afterAsset.capturedAt
                            ? new Date(comp.afterAsset.capturedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : "Recent"}
                        </span>
                      </span>
                      <span className="text-slate-600">&bull;</span>
                      <span className="text-slate-500 text-[10px]">
                        Saved {new Date(comp.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
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

                {/* 2. MIDDLE HIERARCHY: Interactive Comparison Slider */}
                <CompareSlider
                  beforeUrl={comp.beforeAsset.normalizedUrl || comp.beforeAsset.secureUrl}
                  afterUrl={comp.afterAsset.normalizedUrl || comp.afterAsset.secureUrl}
                  beforeDate={comp.beforeAsset.capturedAt}
                  afterDate={comp.afterAsset.capturedAt}
                  aspectRatio="aspect-[16/10]"
                />

                {/* 3. COLLAPSED AI VERIFICATION SECTION (Collapsed by default with toggle) */}
                <div className="rounded-xl bg-slate-950/70 border border-white/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleDetails(comp.id)}
                    className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2">
                      {comp.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          AI-verified ({pct}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Unverified ({pct}%)
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 hidden sm:inline">Scene Analysis</span>
                    </div>

                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <span>{isDetailsExpanded ? "Hide details" : "Show details"}</span>
                      {isDetailsExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>

                  {isDetailsExpanded && (
                    <div className="p-3 pt-1 space-y-2 border-t border-white/5 text-xs animate-fade-in">
                      {comp.aiReason && (
                        <div className="flex items-start gap-1.5 text-slate-300 mt-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                              Verification Reason
                            </span>
                            <span className="leading-relaxed">{comp.aiReason}</span>
                          </div>
                        </div>
                      )}
                      {comp.changeSummary && (
                        <div className="flex items-start gap-1.5 text-emerald-300/90 pt-1.5 border-t border-white/5">
                          <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-teal-400 text-[10px] uppercase tracking-wider block">
                              Visible Physical Change
                            </span>
                            <span className="leading-relaxed">{comp.changeSummary}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. CAPTION / NOTES: Blank by default with "+ Add caption" affordance */}
                <div className="pt-1">
                  {editingCaptionId === comp.id ? (
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-white/10">
                      <input
                        type="text"
                        placeholder="Add a field caption or observation note..."
                        value={captionInput}
                        onChange={(e) => setCaptionInput(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={savingCaption}
                        onClick={() => handleSaveCaption(comp.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition"
                      >
                        {savingCaption ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCaptionId(null);
                          setCaptionInput("");
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-white transition text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : hasRealCaption ? (
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300 flex items-start justify-between gap-2 group/caption">
                      <div className="flex items-start gap-2 italic">
                        <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>&ldquo;{comp.notes}&rdquo;</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCaptionId(comp.id);
                          setCaptionInput(comp.notes || "");
                        }}
                        className="opacity-0 group-hover/caption:opacity-100 p-1 text-slate-400 hover:text-emerald-300 transition"
                        title="Edit caption"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCaptionId(comp.id);
                        setCaptionInput("");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-300 transition py-1 px-1.5 rounded-lg hover:bg-white/5"
                    >
                      <Plus className="w-3 h-3 text-emerald-400" />
                      <span>Add caption</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Cleanup Confirmation Dialog */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div
            className="glass-dropdown w-full max-w-md rounded-3xl p-6 shadow-2xl relative border border-white/10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Brush className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Clean Up Unverified Comparisons
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manual maintenance pass
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will remove all comparison records where <strong className="text-amber-300">verified = false</strong> and AI match confidence is below <strong className="text-amber-300">30%</strong>. This action cannot be undone.
            </p>

            {cleanupFeedback && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>{cleanupFeedback}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowCleanupModal(false)}
                disabled={cleaningUp}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-cleanup-unverified-btn"
                onClick={handleConfirmCleanup}
                disabled={cleaningUp}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                {cleaningUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Clean Up</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
              notes={expandedComp.notes !== "Verification test comparison" ? expandedComp.notes : undefined}
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
