"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookmarkCheck,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Columns2,
  Eye,
  Image as ImageIcon,
  Images,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { CompareSlider } from "./CompareSlider";
import { ComparisonSuggestion } from "@/lib/search/pairing";
import { ComparisonWarningModal } from "./ComparisonWarningModal";
import { EmptyState, ErrorNote, IconChip, Modal, SectionHeader, cx } from "@/components/ui";
import { getThumbnailUrl, withTransformation } from "@/lib/cloudinary-url";

interface SuggestedComparisonsProps {
  projectId: string;
  refreshTrigger?: number;
  onComparisonSaved?: () => void;
}

interface MissingDateAsset {
  id: string;
  secureUrl: string;
  manualLocation?: string | null;
  createdAt: string;
}

function formatDate(value: string | Date | null | undefined, fallback: string) {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const PAIR_CROP = "c_fill,w_600,h_450,g_auto,q_auto,f_auto";

/** A ~600px crop of the photo, sharp enough for the side-by-side pair cards. */
function pairImageUrl(asset: any): string {
  const src = asset?.secureUrl || asset?.normalizedUrl || "";
  return withTransformation(src, PAIR_CROP, asset?.resourceType === "video" ? "jpg" : undefined);
}

/** Two tilted photo frames, used as the empty-state illustration. */
function PhotoPairIcon() {
  return (
    <span className="relative block h-8 w-10" aria-hidden>
      <span className="absolute left-0 top-1.5 flex h-6 w-6 -rotate-[10deg] items-center justify-center rounded-md bg-zinc-100 text-zinc-400 ring-1 ring-zinc-300">
        <ImageIcon className="h-3.5 w-3.5" />
      </span>
      <span className="absolute right-0 top-0 flex h-6 w-6 rotate-[8deg] items-center justify-center rounded-md bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-300">
        <ImageIcon className="h-3.5 w-3.5" />
      </span>
    </span>
  );
}

/** Two large photos side by side, earlier on the left, joined by a round arrow at the seam. */
function PairImages({
  beforeUrl,
  afterUrl,
  beforeDate,
  afterDate,
  corner,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeDate?: string | Date | null;
  afterDate?: string | Date | null;
  corner?: ReactNode;
}) {
  return (
    <div className="relative grid grid-cols-2 gap-[3px] bg-white">
      {[
        { url: beforeUrl, label: "Before", date: beforeDate, dot: "bg-zinc-400" },
        { url: afterUrl, label: "After", date: afterDate, dot: "bg-emerald-500" },
      ].map((img) => (
        <div key={img.label} className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
          <img
            src={img.url}
            alt={`${img.label} photo`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <span className="photo-chip absolute left-2.5 top-2.5">
            <span className={cx("h-1.5 w-1.5 rounded-full", img.dot)} />
            {img.label}
          </span>
          <span className="absolute bottom-2.5 left-2.5 right-2.5 truncate text-xs font-medium tabular-nums text-white drop-shadow-sm">
            {formatDate(img.date, "No date")}
          </span>
        </div>
      ))}
      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-emerald-600 shadow-[0_6px_16px_-6px_rgba(16,24,40,0.45)] ring-4 ring-white/40">
        <ArrowRight className="h-4 w-4" />
      </span>
      {corner && <div className="absolute right-2.5 top-2.5">{corner}</div>}
    </div>
  );
}

/** Placeholder card while pairs load. */
function PairCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2 gap-[3px]">
        <div className="skeleton aspect-[4/3]" />
        <div className="skeleton aspect-[4/3]" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2.5">
          <div className="skeleton h-7 w-7 rounded-md" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
        <div className="flex gap-1.5">
          <div className="skeleton h-5 w-28 rounded-md" />
          <div className="skeleton h-5 w-16 rounded-md" />
        </div>
        <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
          <div className="skeleton h-4 w-14 rounded" />
          <div className="skeleton h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Match score and reason for a pair (the visible change is shown next to the photos). */
function PairDetails({ confidence, reason }: { confidence: number; reason?: string | null }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="space-y-3 rounded-xl bg-zinc-50 px-3.5 py-3 text-xs ring-1 ring-inset ring-zinc-900/5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-500" title="How confident the check is that both photos show the same place">
            Match score
          </span>
          <span className="font-medium tabular-nums text-zinc-900">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70">
          <div
            className="h-full rounded-full bg-violet-500"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>
      {reason && (
        <div className="space-y-0.5">
          <p className="text-zinc-500">Why it&apos;s the same place</p>
          <p className="leading-relaxed text-zinc-700">{reason}</p>
        </div>
      )}
    </div>
  );
}

export function SuggestedComparisons({
  projectId,
  refreshTrigger,
  onComparisonSaved,
}: SuggestedComparisonsProps) {
  const [suggestions, setSuggestions] = useState<ComparisonSuggestion[]>([]);
  const [missingDateCount, setMissingDateCount] = useState<number>(0);
  const [missingDateAssets, setMissingDateAssets] = useState<MissingDateAsset[]>([]);
  const [totalImagesCount, setTotalImagesCount] = useState<number>(0);
  const [noQualifyingReason, setNoQualifyingReason] = useState<string | null>(null);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedPairs, setExpandedPairs] = useState<Record<string, boolean>>({});

  const [activeComparePair, setActiveComparePair] = useState<ComparisonSuggestion | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pairNotes, setPairNotes] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Inline date setter state for missing date assets
  const [settingDateAssetId, setSettingDateAssetId] = useState<string | null>(null);
  const [inlineDateVal, setInlineDateVal] = useState<string>("");
  const [savingInlineDate, setSavingInlineDate] = useState(false);

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

  const toggleDetails = (pairId: string) => {
    setExpandedPairs((prev) => ({
      ...prev,
      [pairId]: !prev[pairId],
    }));
  };

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
      setMissingDateAssets(data.missingDateAssets || []);
      setTotalImagesCount(data.totalImagesCount || 0);
      setNoQualifyingReason(data.noQualifyingReason || null);
      setDiagnosticMessage(data.message || "");
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
  }, [projectId, refreshTrigger]);

  const handleSaveInlineDate = async (assetId: string) => {
    if (!inlineDateVal) return;
    try {
      setSavingInlineDate(true);
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capturedAt: new Date(inlineDateVal).toISOString() }),
      });
      if (res.ok) {
        setSettingDateAssetId(null);
        await loadSuggestions();
        if (onComparisonSaved) {
          onComparisonSaved();
        }
      }
    } catch (err) {
      console.error("Failed to update date", err);
    } finally {
      setSavingInlineDate(false);
    }
  };

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

  const openPreview = (pair: ComparisonSuggestion) => {
    setActiveComparePair(pair);
    setPairNotes("");
    setSaveSuccess(false);
    setSaveError("");
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
          notes: pairNotes.trim() || undefined,
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
        notes: "",
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

  const renderHeader = (action?: ReactNode) => (
    <SectionHeader
      icon={Sparkles}
      tone="violet"
      title={
        <span className="flex items-center gap-2">
          Suggested pairs
          {suggestions.length > 0 && !loading && !error && (
            <span className="badge badge-violet tabular-nums">{suggestions.length}</span>
          )}
        </span>
      }
      description="Earlier and later photos of the same place, matched for you."
      actions={action}
    />
  );

  if (loading) {
    return (
      <section className="space-y-4">
        {renderHeader()}
        <p className="flex items-center gap-2 text-[13px] text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
          Looking for matching photos. This can take a few seconds.
        </p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <PairCardSkeleton />
          <PairCardSkeleton />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        {renderHeader()}
        <ErrorNote>{error}</ErrorNote>
      </section>
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

  const isMissingDatesReason = totalImagesCount >= 2 && missingDateCount > 0;

  return (
    <section className="space-y-4">
      {renderHeader(
        <button
          type="button"
          id="open-manual-picker-btn"
          onClick={handleOpenManualPicker}
          className="btn btn-secondary btn-sm shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Choose two photos
        </button>,
      )}

      {suggestions.length === 0 ? (
        isMissingDatesReason ? (
          <div className="card overflow-hidden">
            <div className="flex items-start gap-3 border-b border-amber-100 bg-gradient-to-br from-amber-50 via-amber-50/40 to-white px-4 py-4 sm:px-5">
              <IconChip icon={CalendarClock} tone="amber" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">Add dates to get suggestions</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-600">
                  {missingDateCount} photo{missingDateCount === 1 ? " is" : "s are"} missing the date it was taken. Add
                  dates so we can suggest pairs.
                </p>
              </div>
            </div>

            {/* Photos missing a capture date, each with an inline date setter */}
            {missingDateAssets.length > 0 && (
              <div className="max-h-80 divide-y divide-zinc-100 overflow-y-auto">
                {missingDateAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-col gap-3 px-4 py-3 transition hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={getThumbnailUrl(asset.secureUrl, "image")}
                        alt="Photo preview"
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100 object-cover ring-1 ring-zinc-900/5"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {asset.manualLocation || "Untitled photo"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Uploaded {formatDate(asset.createdAt, "recently")} ·{" "}
                          <span className="text-amber-700">No date taken</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {settingDateAssetId === asset.id ? (
                        <>
                          <input
                            type="datetime-local"
                            value={inlineDateVal}
                            onChange={(e) => setInlineDateVal(e.target.value)}
                            aria-label="Date taken"
                            className="input h-8 min-w-0 flex-1 text-[13px] sm:w-auto sm:flex-none"
                          />
                          <button
                            type="button"
                            disabled={savingInlineDate || !inlineDateVal}
                            onClick={() => handleSaveInlineDate(asset.id)}
                            className="btn btn-primary btn-sm"
                          >
                            {savingInlineDate && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setSettingDateAssetId(null)}
                            aria-label="Cancel"
                            className="btn btn-ghost btn-sm btn-icon"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSettingDateAssetId(asset.id);
                            setInlineDateVal(new Date().toISOString().slice(0, 16));
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          <Calendar className="h-3.5 w-3.5 text-sky-600" />
                          Add date
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={PhotoPairIcon}
            title={totalImagesCount < 2 ? "Not enough photos yet" : "No matching pairs found"}
            description={
              totalImagesCount < 2
                ? "A before and after pair shows the same place at two different times. Upload at least two photos to get suggestions."
                : "A before and after pair shows the same place at two different times. Upload photos of the same place taken at different times, or choose two photos yourself."
            }
            action={
              totalImagesCount >= 2 ? (
                <button type="button" onClick={handleOpenManualPicker} className="btn btn-primary">
                  <Plus className="h-4 w-4" />
                  Choose two photos
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {suggestions.map((pair) => {
            const detailsOpen = Boolean(expandedPairs[pair.id]);
            const savedHref = pair.savedComparisonId
              ? `/projects/${projectId}/compare/${pair.savedComparisonId}`
              : null;

            return (
              <article key={pair.id} className="group card-interactive flex flex-col">
                <button
                  type="button"
                  onClick={() => openPreview(pair)}
                  aria-label={`Preview ${pair.locationLabel}`}
                  className="block w-full overflow-hidden rounded-t-[15px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <PairImages
                    beforeUrl={pairImageUrl(pair.before)}
                    afterUrl={pairImageUrl(pair.after)}
                    beforeDate={pair.before.capturedAt}
                    afterDate={pair.after.capturedAt}
                    corner={
                      pair.alreadySaved ? (
                        <span className="photo-chip text-emerald-700">
                          <BookmarkCheck className="h-3 w-3" />
                          Saved
                        </span>
                      ) : undefined
                    }
                  />
                </button>

                <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconChip icon={MapPin} tone="sky" size="sm" />
                    <p className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">
                      {pair.locationLabel}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="badge badge-blue">
                      <Clock className="h-3 w-3" />
                      {pair.timeSpanLabel}
                    </span>
                    {pair.verified && (
                      <span className="badge badge-green" title="Checked to show the same place">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                  </div>

                  {pair.visibleChange && (
                    <p className="flex gap-2 text-[13px] leading-relaxed text-zinc-600">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
                      <span className="line-clamp-2" title={pair.visibleChange}>
                        {pair.visibleChange}
                      </span>
                    </p>
                  )}

                  {detailsOpen && (
                    <div className="animate-fade-in">
                      <PairDetails confidence={pair.confidence} reason={pair.reason} />
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <button
                      type="button"
                      onClick={() => toggleDetails(pair.id)}
                      aria-expanded={detailsOpen}
                      className="inline-flex items-center gap-1 rounded text-[13px] text-zinc-500 transition hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                    >
                      Details
                      <ChevronDown className={cx("h-3.5 w-3.5 transition", detailsOpen && "rotate-180")} />
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        id={`open-compare-${pair.id}`}
                        onClick={() => openPreview(pair)}
                        className="btn btn-ghost btn-sm"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>

                      <button
                        type="button"
                        id={`save-pair-${pair.id}`}
                        onClick={() => handleSaveComparison(pair)}
                        disabled={pair.alreadySaved || savingId === pair.id}
                        className={cx(
                          "btn btn-sm",
                          pair.alreadySaved ? "btn-ghost text-emerald-700 disabled:opacity-100" : "btn-primary",
                        )}
                      >
                        {savingId === pair.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : pair.alreadySaved ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <BookmarkCheck className="h-3.5 w-3.5" />
                        )}
                        {pair.alreadySaved ? "Saved" : "Save comparison"}
                      </button>

                      {pair.alreadySaved && savedHref && (
                        <Link
                          href={savedHref}
                          title="Measure the change and make a short video"
                          className="btn btn-secondary btn-sm"
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Preview a suggested pair with the slider */}
      <Modal
        open={Boolean(activeComparePair)}
        onClose={() => setActiveComparePair(null)}
        size="xl"
        icon={Columns2}
        title={activeComparePair?.locationLabel}
        description={
          activeComparePair
            ? `${formatDate(activeComparePair.before.capturedAt, "Earlier")} → ${formatDate(
                activeComparePair.after.capturedAt,
                "Later",
              )} · ${activeComparePair.timeSpanLabel}`
            : undefined
        }
        footer={
          activeComparePair && (
            <>
              <button type="button" onClick={() => setActiveComparePair(null)} className="btn btn-ghost btn-sm">
                Close
              </button>
              <button
                type="button"
                id="modal-confirm-save-pair-btn"
                onClick={() => handleSaveComparison(activeComparePair)}
                disabled={activeComparePair.alreadySaved || savingId === activeComparePair.id}
                className={cx(
                  "btn btn-sm",
                  activeComparePair.alreadySaved ? "btn-secondary text-emerald-700 disabled:opacity-100" : "btn-primary",
                )}
              >
                {savingId === activeComparePair.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : activeComparePair.alreadySaved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                )}
                {activeComparePair.alreadySaved ? "Saved" : "Save comparison"}
              </button>
            </>
          )
        }
      >
        {activeComparePair && (
          <div className="space-y-4">
            <CompareSlider
              beforeUrl={activeComparePair.before.normalizedUrl || activeComparePair.before.secureUrl}
              afterUrl={activeComparePair.after.normalizedUrl || activeComparePair.after.secureUrl}
              beforeDate={activeComparePair.before.capturedAt}
              afterDate={activeComparePair.after.capturedAt}
              beforeLabel="Before"
              afterLabel="After"
            />

            {activeComparePair.visibleChange && (
              <div className="flex gap-3 rounded-xl bg-violet-50/60 px-4 py-3 ring-1 ring-inset ring-violet-600/10">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-violet-900">What changed</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-zinc-700">{activeComparePair.visibleChange}</p>
                </div>
              </div>
            )}

            <details className="group rounded-xl border border-zinc-200">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
                Details
                <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-zinc-100 p-3">
                <PairDetails confidence={activeComparePair.confidence} reason={activeComparePair.reason} />
              </div>
            </details>

            <div>
              <label htmlFor="suggested-pair-notes" className="label">
                Notes <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <textarea
                id="suggested-pair-notes"
                value={pairNotes}
                onChange={(e) => setPairNotes(e.target.value)}
                placeholder="What changed between the two photos?"
                rows={2}
                className="input"
              />
            </div>

            {saveSuccess && (
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                <Check className="h-4 w-4" /> Comparison saved
              </p>
            )}
            {saveError && <ErrorNote>{saveError}</ErrorNote>}
          </div>
        )}
      </Modal>

      {/* Manually pick two photos */}
      <Modal
        open={showManualPicker}
        onClose={() => setShowManualPicker(false)}
        size="lg"
        icon={Images}
        title="Choose two photos"
        description={
          <>
            Pick an earlier and a later photo of the same place. We&apos;ll put them in date order.{" "}
            <span className="tabular-nums text-zinc-700">{selectedAssetIds.length} of 2 selected.</span>
          </>
        }
        footer={
          <>
            <button type="button" onClick={() => setShowManualPicker(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveManualPair}
              disabled={selectedAssetIds.length !== 2 || manualSaving}
              className="btn btn-primary btn-sm"
            >
              {manualSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save comparison
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {loadingAssets ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Loading photos">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="skeleton aspect-square rounded-lg" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                </div>
              ))}
            </div>
          ) : projectAssets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <IconChip icon={ImageIcon} tone="zinc" size="lg" />
              <p className="text-sm text-zinc-500">This project has no photos yet.</p>
            </div>
          ) : (
            <div className="grid max-h-[45vh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4">
              {projectAssets.map((asset) => {
                const isSelected = selectedAssetIds.includes(asset.id);
                const role =
                  manualBefore && manualAfter
                    ? asset.id === manualBefore.id
                      ? "Before"
                      : asset.id === manualAfter.id
                        ? "After"
                        : null
                    : null;
                return (
                  <button
                    type="button"
                    key={asset.id}
                    onClick={() => toggleAssetSelection(asset.id)}
                    aria-pressed={isSelected}
                    className="group min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                  >
                    <div
                      className={cx(
                        "relative aspect-square overflow-hidden rounded-lg bg-zinc-100 ring-offset-2 transition",
                        isSelected ? "ring-2 ring-emerald-500" : "ring-1 ring-zinc-200 group-hover:ring-zinc-300",
                      )}
                    >
                      <img
                        src={getThumbnailUrl(asset.secureUrl, asset.resourceType)}
                        alt="Project photo"
                        loading="lazy"
                        className={cx(
                          "h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]",
                          isSelected && "scale-[1.02]",
                        )}
                      />
                      {isSelected && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm ring-2 ring-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      {role && (
                        <span className="photo-chip absolute bottom-1.5 left-1.5">
                          <span
                            className={cx(
                              "h-1.5 w-1.5 rounded-full",
                              role === "Before" ? "bg-zinc-400" : "bg-emerald-500",
                            )}
                          />
                          {role}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium text-zinc-700">
                      {asset.manualLocation || "Untitled photo"}
                    </p>
                    <p className="truncate text-xs tabular-nums text-zinc-500">
                      {formatDate(asset.capturedAt, "No date taken")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Slider preview once two photos are selected */}
          {manualBefore && manualAfter && (
            <div className="space-y-2.5 border-t border-zinc-100 pt-4">
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <Columns2 className="h-4 w-4 text-emerald-600" />
                Preview
              </p>
              <CompareSlider
                beforeUrl={manualBefore.secureUrl}
                afterUrl={manualAfter.secureUrl}
                beforeDate={manualBefore.capturedAt}
                afterDate={manualAfter.capturedAt}
                beforeLabel="Before"
                afterLabel="After"
                location={manualBefore.manualLocation || manualAfter.manualLocation}
              />
            </div>
          )}
        </div>
      </Modal>

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
    </section>
  );
}
