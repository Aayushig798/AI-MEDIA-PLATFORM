"use client";

import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Layers, 
  Calendar, 
  MapPin, 
  ArrowRight, 
  BookmarkPlus, 
  Check, 
  X, 
  Loader2, 
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus
} from "lucide-react";
import { CompareSlider } from "./CompareSlider";
import { ComparisonSuggestion } from "@/lib/search/pairing";
import { ComparisonWarningModal } from "./ComparisonWarningModal";

interface SuggestedComparisonsProps {
  projectId: string;
  onComparisonSaved?: () => void;
}

export function SuggestedComparisons({
  projectId,
  onComparisonSaved,
}: SuggestedComparisonsProps) {
  const [suggestions, setSuggestions] = useState<ComparisonSuggestion[]>([]);
  const [missingDateCount, setMissingDateCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeComparePair, setActiveComparePair] = useState<ComparisonSuggestion | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pairNotes, setPairNotes] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Manual Picker State
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [projectAssets, setProjectAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [manualSaving, setManualSaving] = useState(false);

  // Warning Modal State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [pendingSavePayload, setPendingSavePayload] = useState<any>(null);
  const [savingAnyway, setSavingAnyway] = useState(false);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/projects/${projectId}/suggested-comparisons`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load suggested comparisons");
      }
      setSuggestions(data.suggestions || []);
      setMissingDateCount(data.missingDateCount || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadSuggestions();
    }
  }, [projectId]);

  const loadProjectAssets = async () => {
    try {
      setLoadingAssets(true);
      const res = await fetch(`/api/projects/${projectId}/assets`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Filter to images only
        const images = (data.assets || []).filter((a: any) => a.resourceType === "image");
        setProjectAssets(images);
      }
    } catch (e) {
      console.error("Failed to load project assets for comparison:", e);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleOpenManualPicker = () => {
    setShowManualPicker(true);
    setSelectedAssetIds([]);
    loadProjectAssets();
  };

  const toggleAssetSelection = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter((id) => id !== assetId));
    } else {
      if (selectedAssetIds.length < 2) {
        setSelectedAssetIds([...selectedAssetIds, assetId]);
      } else {
        setSelectedAssetIds([selectedAssetIds[0], assetId]);
      }
    }
  };

  const handleSaveComparison = async (pair: ComparisonSuggestion) => {
    try {
      setSavingId(pair.id);
      setSaveError("");
      setSaveSuccess(false);

      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          beforeAssetId: pair.before.id,
          afterAssetId: pair.after.id,
          notes: pairNotes.trim() || `Auto-suggested comparison for ${pair.locationLabel} (${pair.timeSpanLabel})`,
          verified: pair.verified,
          matchConfidence: pair.confidence,
          aiReason: pair.reason,
          changeSummary: pair.visibleChange,
          saveAnyway: true, // Already verified by AI engine
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save comparison");
      }

      setSaveSuccess(true);
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === pair.id ? { ...s, alreadySaved: true, savedComparisonId: data.comparison.id } : s
        )
      );

      if (onComparisonSaved) {
        onComparisonSaved();
      }

      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save comparison");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveManualPair = async () => {
    if (selectedAssetIds.length !== 2) return;
    try {
      setManualSaving(true);
      const assetA = projectAssets.find((a) => a.id === selectedAssetIds[0]);
      const assetB = projectAssets.find((a) => a.id === selectedAssetIds[1]);

      if (!assetA || !assetB) return;

      // Order by capturedAt automatically
      let before = assetA;
      let after = assetB;
      if (assetA.capturedAt && assetB.capturedAt) {
        if (new Date(assetA.capturedAt).getTime() > new Date(assetB.capturedAt).getTime()) {
          before = assetB;
          after = assetA;
        }
      } else if (!assetA.capturedAt && assetB.capturedAt) {
        before = assetB;
        after = assetA;
      } else {
        const tA = new Date(assetA.createdAt).getTime();
        const tB = new Date(assetB.createdAt).getTime();
        if (tA > tB) {
          before = assetB;
          after = assetA;
        }
      }

      const payload = {
        projectId,
        beforeAssetId: before.id,
        afterAssetId: after.id,
        notes: `Manual comparison pair`,
      };

      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.warning && data.needsConfirmation) {
        setWarningReason(data.reason || "These photos do not look like the same scene or have insufficient date separation.");
        setPendingSavePayload({
          ...payload,
          beforeAssetId: data.orderedBeforeId || before.id,
          afterAssetId: data.orderedAfterId || after.id,
          warningReason: data.reason,
        });
        setShowWarningModal(true);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save comparison");
      }

      setShowManualPicker(false);
      setSelectedAssetIds([]);
      if (onComparisonSaved) {
        onComparisonSaved();
      }
      loadSuggestions();
    } catch (err: any) {
      alert(err.message || "Failed to save comparison");
    } finally {
      setManualSaving(false);
    }
  };

  const handleConfirmSaveAnyway = async () => {
    if (!pendingSavePayload) return;
    try {
      setSavingAnyway(true);
      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingSavePayload,
          saveAnyway: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save comparison");
      }

      setShowWarningModal(false);
      setPendingSavePayload(null);
      setShowManualPicker(false);
      setSelectedAssetIds([]);
      if (onComparisonSaved) {
        onComparisonSaved();
      }
      loadSuggestions();
    } catch (err: any) {
      alert(err.message || "Failed to save comparison");
    } finally {
      setSavingAnyway(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        <span className="text-xs">Analyzing spatial & temporal metadata for pairs...</span>
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

  // Selected assets for manual preview
  const manualA = projectAssets.find((a) => a.id === selectedAssetIds[0]);
  const manualB = projectAssets.find((a) => a.id === selectedAssetIds[1]);
  let manualBefore = manualA;
  let manualAfter = manualB;
  if (manualA && manualB) {
    if (manualA.capturedAt && manualB.capturedAt) {
      if (new Date(manualA.capturedAt).getTime() > new Date(manualB.capturedAt).getTime()) {
        manualBefore = manualB;
        manualAfter = manualA;
      }
    } else {
      const tA = new Date(manualA.createdAt).getTime();
      const tB = new Date(manualB.createdAt).getTime();
      if (tA > tB) {
        manualBefore = manualB;
        manualAfter = manualA;
      }
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-8 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-200">
            No valid before/after pairs found. Upload photos of the same location taken at different times.
          </h4>
          {missingDateCount > 0 && (
            <p className="text-xs text-amber-300/90 font-medium max-w-md mx-auto bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl">
              Set Date taken on these photos to enable comparison ({missingDateCount} photo{missingDateCount === 1 ? "" : "s"} missing Date taken)
            </p>
          )}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              id="open-manual-picker-btn"
              onClick={handleOpenManualPicker}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Select Custom Pair to Compare</span>
            </button>
          </div>
        </div>

        {/* Manual Picker Modal */}
        {showManualPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div
              className="glass-dropdown w-full max-w-3xl max-h-[92vh] rounded-3xl p-6 shadow-2xl relative border border-white/10 overflow-y-auto flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                    Select Two Photos to Compare
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pick 2 images ({selectedAssetIds.length}/2 selected). Photos will be ordered chronologically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualPicker(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingAssets ? (
                <div className="py-12 flex justify-center items-center text-xs text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  Loading project images...
                </div>
              ) : projectAssets.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No image assets found in this project.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[45vh] overflow-y-auto pr-1">
                  {projectAssets.map((asset) => {
                    const isSelected = selectedAssetIds.includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => toggleAssetSelection(asset.id)}
                        className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition ${
                          isSelected
                            ? "border-emerald-500 shadow-lg shadow-emerald-500/30 scale-[0.98]"
                            : "border-white/5 hover:border-white/20"
                        }`}
                      >
                        <img
                          src={asset.secureUrl}
                          alt="asset"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 text-[10px] text-slate-200">
                          <span className="truncate font-semibold">{asset.manualLocation || "Project Location"}</span>
                          <span className="text-slate-400">
                            {asset.capturedAt ? new Date(asset.capturedAt).toLocaleDateString() : "No Date taken"}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px] shadow">
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Slider Preview if 2 selected */}
              {manualBefore && manualAfter && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-xs font-semibold text-slate-300 mb-2">Live Alignment Preview:</h4>
                  <CompareSlider
                    beforeUrl={manualBefore.secureUrl}
                    afterUrl={manualAfter.secureUrl}
                    beforeDate={manualBefore.capturedAt}
                    afterDate={manualAfter.capturedAt}
                    beforeLabel="BEFORE"
                    afterLabel="AFTER"
                    location={manualBefore.manualLocation || manualAfter.manualLocation}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-xs text-slate-400">
                  {selectedAssetIds.length === 2 ? "Ready to verify and save" : "Select exactly 2 photos"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualPicker(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManualPair}
                    disabled={selectedAssetIds.length !== 2 || manualSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition shadow-lg shadow-emerald-500/20"
                  >
                    {manualSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                    <span>Save Comparison</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Modal */}
        <ComparisonWarningModal
          isOpen={showWarningModal}
          reason={warningReason}
          onConfirmSaveAnyway={handleConfirmSaveAnyway}
          onCancel={() => {
            setShowWarningModal(false);
            setPendingSavePayload(null);
          }}
          saving={savingAnyway}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <h3 className="text-sm font-bold text-white tracking-tight">
            AI Suggested Before / After Pairs ({suggestions.length})
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenManualPicker}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>Custom Pair</span>
          </button>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Matched by geographic proximity & date progression
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map((pair) => {
          const pct = Math.round(pair.confidence * 100);

          return (
            <div
              key={pair.id}
              className="glass-card rounded-2xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {pair.locationLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Clock className="w-3 h-3" />
                    {pair.timeSpanLabel}
                  </span>
                </div>

                {/* AI Verification Confidence Badge */}
                <div className="mb-2.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    AI-verified same scene ({pct}%)
                  </span>
                </div>

                {/* Side-by-side previews */}
                <div className="grid grid-cols-2 gap-2 relative rounded-xl overflow-hidden mb-3 bg-slate-950 p-1 border border-white/5">
                  {/* Before Thumbnail */}
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden group/thumb">
                    <img
                      src={pair.before.normalizedUrl || pair.before.secureUrl}
                      alt="Before evidence"
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition"
                    />
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-bold text-amber-400 border border-amber-500/30 backdrop-blur-sm">
                      BEFORE
                    </div>
                    <div className="absolute bottom-1 left-1 right-1 text-[10px] text-slate-200 bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-sm truncate">
                      {pair.before.capturedAt ? new Date(pair.before.capturedAt).toLocaleDateString() : "Earlier"}
                    </div>
                  </div>

                  {/* After Thumbnail */}
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden group/thumb">
                    <img
                      src={pair.after.normalizedUrl || pair.after.secureUrl}
                      alt="After evidence"
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition"
                    />
                    <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
                      AFTER
                    </div>
                    <div className="absolute bottom-1 left-1 right-1 text-[10px] text-slate-200 bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-sm truncate">
                      {pair.after.capturedAt ? new Date(pair.after.capturedAt).toLocaleDateString() : "Recent"}
                    </div>
                  </div>

                  {/* Center Transition Icon */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg pointer-events-none z-10 border-2 border-slate-950">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* AI Reason & Visible Change */}
                {(pair.reason || pair.visibleChange) && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-white/5 text-xs mb-3">
                    {pair.reason && (
                      <div className="flex items-start gap-1.5 text-slate-300">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider block">
                            AI Verification
                          </span>
                          <span className="leading-relaxed">{pair.reason}</span>
                        </div>
                      </div>
                    )}
                    {pair.visibleChange && (
                      <div className="flex items-start gap-1.5 text-emerald-300/90 pt-1 border-t border-white/5">
                        <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-teal-400 text-[10px] uppercase tracking-wider block">
                            Visible Change
                          </span>
                          <span className="leading-relaxed">{pair.visibleChange}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  id={`open-compare-${pair.id}`}
                  onClick={() => {
                    setActiveComparePair(pair);
                    setPairNotes("");
                    setSaveSuccess(false);
                    setSaveError("");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Interactive Slider</span>
                </button>

                <button
                  type="button"
                  id={`save-pair-${pair.id}`}
                  onClick={() => handleSaveComparison(pair)}
                  disabled={pair.alreadySaved || savingId === pair.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    pair.alreadySaved
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20"
                  }`}
                >
                  {savingId === pair.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : pair.alreadySaved ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  )}
                  <span>{pair.alreadySaved ? "Saved Pair" : "Save Pair"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Modal Slider */}
      {activeComparePair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div
            className="glass-dropdown w-full max-w-4xl max-h-[92vh] rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-white/10 overflow-y-auto flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Evidence Comparison Slider
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      AI-verified ({Math.round(activeComparePair.confidence * 100)}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {activeComparePair.locationLabel}
                    </span>
                    <span>&bull;</span>
                    <span className="text-amber-400">{activeComparePair.timeSpanLabel}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveComparePair(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slider View */}
            <CompareSlider
              beforeUrl={activeComparePair.before.normalizedUrl || activeComparePair.before.secureUrl}
              afterUrl={activeComparePair.after.normalizedUrl || activeComparePair.after.secureUrl}
              beforeDate={activeComparePair.before.capturedAt}
              afterDate={activeComparePair.after.capturedAt}
              beforeLabel="BEFORE"
              afterLabel="AFTER"
            />

            {/* AI Verification notes in modal */}
            {(activeComparePair.reason || activeComparePair.visibleChange) && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900/60 border border-white/5 text-xs">
                {activeComparePair.reason && (
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{activeComparePair.reason}</span>
                  </div>
                )}
                {activeComparePair.visibleChange && (
                  <div className="flex items-start gap-1.5 text-emerald-300 pt-1 border-t border-white/5">
                    <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <span>{activeComparePair.visibleChange}</span>
                  </div>
                )}
              </div>
            )}

            {/* Save Form & Notes */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Evidence Observation Notes
                </label>
                {saveSuccess && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Comparison saved to project!
                  </span>
                )}
                {saveError && (
                  <span className="text-xs text-red-400">{saveError}</span>
                )}
              </div>

              <textarea
                value={pairNotes}
                onChange={(e) => setPairNotes(e.target.value)}
                placeholder="E.g. Visible riverbank stabilization and vegetation recovery observed across 3 months..."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveComparePair(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Close
                </button>

                <button
                  type="button"
                  id="modal-confirm-save-pair-btn"
                  onClick={() => handleSaveComparison(activeComparePair)}
                  disabled={activeComparePair.alreadySaved || savingId === activeComparePair.id}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeComparePair.alreadySaved
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                  }`}
                >
                  {savingId === activeComparePair.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : activeComparePair.alreadySaved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <BookmarkPlus className="w-4 h-4" />
                  )}
                  <span>{activeComparePair.alreadySaved ? "Saved" : "Save Comparison Record"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Picker Modal */}
      {showManualPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div
            className="glass-dropdown w-full max-w-3xl max-h-[92vh] rounded-3xl p-6 shadow-2xl relative border border-white/10 overflow-y-auto flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  Select Two Photos to Compare
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pick 2 images ({selectedAssetIds.length}/2 selected). Photos will be ordered chronologically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualPicker(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingAssets ? (
              <div className="py-12 flex justify-center items-center text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                Loading project images...
              </div>
            ) : projectAssets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No image assets found in this project.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[45vh] overflow-y-auto pr-1">
                {projectAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => toggleAssetSelection(asset.id)}
                      className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition ${
                        isSelected
                          ? "border-emerald-500 shadow-lg shadow-emerald-500/30 scale-[0.98]"
                          : "border-white/5 hover:border-white/20"
                      }`}
                    >
                      <img
                        src={asset.secureUrl}
                        alt="asset"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 text-[10px] text-slate-200">
                        <span className="truncate font-semibold">{asset.manualLocation || "Project Location"}</span>
                        <span className="text-slate-400">
                          {asset.capturedAt ? new Date(asset.capturedAt).toLocaleDateString() : "No Date taken"}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px] shadow">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Slider Preview if 2 selected */}
            {manualBefore && manualAfter && (
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Live Alignment Preview:</h4>
                <CompareSlider
                  beforeUrl={manualBefore.secureUrl}
                  afterUrl={manualAfter.secureUrl}
                  beforeDate={manualBefore.capturedAt}
                  afterDate={manualAfter.capturedAt}
                  beforeLabel="BEFORE"
                  afterLabel="AFTER"
                  location={manualBefore.manualLocation || manualAfter.manualLocation}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs text-slate-400">
                {selectedAssetIds.length === 2 ? "Ready to verify and save" : "Select exactly 2 photos"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualPicker(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualPair}
                  disabled={selectedAssetIds.length !== 2 || manualSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition shadow-lg shadow-emerald-500/20"
                >
                  {manualSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                  <span>Save Comparison</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      <ComparisonWarningModal
        isOpen={showWarningModal}
        reason={warningReason}
        onConfirmSaveAnyway={handleConfirmSaveAnyway}
        onCancel={() => {
          setShowWarningModal(false);
          setPendingSavePayload(null);
        }}
        saving={savingAnyway}
      />
    </div>
  );
}
