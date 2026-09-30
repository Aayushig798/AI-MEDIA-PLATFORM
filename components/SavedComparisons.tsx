"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  ArrowRight,
  BookmarkCheck,
  Check,
  ChevronDown,
  Clock,
  Columns2,
  Droplets,
  Eraser,
  Image as ImageIcon,
  Leaf,
  Loader2,
  MapPin,
  Maximize2,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { CompareSlider } from "./CompareSlider";
import { ConfirmDialog, EmptyState, ErrorNote, IconChip, Menu, Modal, SectionHeader, cx } from "@/components/ui";
import { withTransformation } from "@/lib/cloudinary-url";

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

function formatDate(value: string | Date | null | undefined, fallback: string) {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "8 months apart" etc. from the two capture dates; null when either date is missing. */
function timeApart(a?: string | Date | null, b?: string | Date | null): string | null {
  if (!a || !b) return null;
  const ms = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  if (isNaN(ms)) return null;
  const days = ms / 86_400_000;
  if (days < 1) {
    const h = Math.max(1, Math.round(days * 24));
    return `${h} hour${h > 1 ? "s" : ""} apart`;
  }
  if (days >= 365) {
    const y = Math.round((days / 365) * 10) / 10;
    return `${y} year${y === 1 ? "" : "s"} apart`;
  }
  if (days >= 30) {
    const m = Math.round(days / 30);
    return `${m} month${m > 1 ? "s" : ""} apart`;
  }
  const d = Math.round(days);
  return `${d} day${d === 1 ? "" : "s"} apart`;
}

/** Latest measured change, only if the comparison data already carries metrics. */
function measuredChange(comp: SavedComparisonItem): { kind: "GREEN_COVER" | "WATER_AREA"; deltaPp: number } | null {
  const metrics = (comp as any).metrics;
  if (!Array.isArray(metrics)) return null;
  const valid = metrics.filter(
    (m: any) => m && typeof m.deltaPp === "number" && (m.metric === "GREEN_COVER" || m.metric === "WATER_AREA"),
  );
  if (valid.length === 0) return null;
  const latest = [...valid].sort(
    (x: any, y: any) => new Date(y.createdAt ?? 0).getTime() - new Date(x.createdAt ?? 0).getTime(),
  )[0];
  return { kind: latest.metric, deltaPp: Math.round(latest.deltaPp * 10) / 10 };
}

const PAIR_CROP = "c_fill,w_600,h_450,g_auto,q_auto,f_auto";

/** A ~600px crop of the photo, sharp enough for the side-by-side cards. */
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
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeDate?: string | Date | null;
  afterDate?: string | Date | null;
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
    </div>
  );
}

/** Placeholder card while comparisons load. */
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
          <div className="skeleton h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function VerifiedBadge({ verified }: { verified?: boolean }) {
  return verified ? (
    <span className="badge badge-green shrink-0" title="Checked to show the same place">
      <ShieldCheck className="h-3 w-3" />
      Verified
    </span>
  ) : (
    <span className="badge badge-neutral shrink-0" title="Not confirmed to show the same place">
      Unverified
    </span>
  );
}

/** Match score, reason, visible change and save date for a comparison. */
function ComparisonDetails({ comp, pct }: { comp: SavedComparisonItem; pct: number | null }) {
  return (
    <div className="space-y-3 rounded-xl bg-zinc-50 px-3.5 py-3 text-xs ring-1 ring-inset ring-zinc-900/5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-500" title="How confident the check is that both photos show the same place">
            Match score
          </span>
          <span className="font-medium tabular-nums text-zinc-900">{pct === null ? "Not checked" : `${pct}%`}</span>
        </div>
        {pct !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-zinc-500">Saved</span>
        <span className="tabular-nums text-zinc-900">{formatDate(comp.createdAt, "Unknown")}</span>
      </div>
      {comp.changeSummary && (
        <div className="space-y-0.5">
          <p className="text-zinc-500">What changed</p>
          <p className="leading-relaxed text-zinc-700">{comp.changeSummary}</p>
        </div>
      )}
      {comp.aiReason && (
        <div className="space-y-0.5">
          <p className="text-zinc-500">Why it&apos;s the same place</p>
          <p className="leading-relaxed text-zinc-700">{comp.aiReason}</p>
        </div>
      )}
    </div>
  );
}

const matchPct = (comp: SavedComparisonItem) =>
  typeof comp.matchConfidence === "number" ? Math.round(comp.matchConfidence * 100) : null;

export function SavedComparisons({
  projectId,
  refreshTrigger = 0,
}: SavedComparisonsProps) {
  const [comparisons, setComparisons] = useState<SavedComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const renderHeader = (count?: number, action?: ReactNode) => (
    <SectionHeader
      icon={BookmarkCheck}
      tone="emerald"
      title={
        <span className="flex items-center gap-2">
          Saved comparisons
          {count ? <span className="badge badge-green tabular-nums">{count}</span> : null}
        </span>
      }
      description="Open one to measure the change and make a short video."
      actions={action}
    />
  );

  if (loading) {
    return (
      <section className="space-y-4" aria-busy="true">
        {renderHeader()}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <PairCardSkeleton />
          <PairCardSkeleton />
          <div className="hidden xl:block">
            <PairCardSkeleton />
          </div>
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

  // Count unverified low-confidence comparisons
  const unverifiedLowConfCount = comparisons.filter(
    (c) => c.verified === false && typeof c.matchConfidence === "number" && c.matchConfidence < 0.3
  ).length;

  const isPlaceholderCaption = (notes?: string | null) => notes === "Verification test comparison";
  const locationOf = (comp: SavedComparisonItem) =>
    comp.beforeAsset?.manualLocation || comp.afterAsset?.manualLocation || "Untitled location";

  return (
    <section className="space-y-4">
      {renderHeader(
        comparisons.length,
        comparisons.length > 0 && (
          <button
            type="button"
            id="cleanup-unverified-comparisons-btn"
            onClick={() => setShowCleanupModal(true)}
            className="btn btn-ghost btn-sm shrink-0"
            title="Remove unverified comparisons with a match score under 30%"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clean up
            {unverifiedLowConfCount > 0 && (
              <span className="rounded-md bg-amber-50 px-1.5 text-xs font-medium tabular-nums text-amber-700 ring-1 ring-inset ring-amber-600/20">
                {unverifiedLowConfCount}
              </span>
            )}
          </button>
        ),
      )}

      {comparisons.length === 0 ? (
        <EmptyState
          icon={PhotoPairIcon}
          title="No saved comparisons yet"
          description="A saved comparison keeps an earlier and a later photo of the same place side by side. Save a suggested pair above, or choose two photos to compare."
          action={
            <ol className="grid gap-2 text-left sm:grid-cols-3">
              {[
                "Pick an earlier and a later photo",
                "Save them as a pair",
                "Measure the change and make a video",
              ].map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-zinc-200/80"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-snug text-zinc-600">{step}</span>
                </li>
              ))}
            </ol>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {comparisons.map((comp) => {
            if (!comp.beforeAsset || !comp.afterAsset) return null;

            const pct = matchPct(comp);
            const isDetailsExpanded = Boolean(expandedDetailsMap[comp.id]);
            const compareHref = `/projects/${comp.projectId}/compare/${comp.id}`;
            const apart = timeApart(comp.beforeAsset.capturedAt, comp.afterAsset.capturedAt);
            const change = measuredChange(comp);

            // Filter out default placeholder caption
            const hasRealCaption =
              comp.notes &&
              comp.notes.trim() !== "" &&
              !isPlaceholderCaption(comp.notes);

            return (
              <article
                key={comp.id}
                id={`saved-comp-${comp.id}`}
                className="group card-interactive relative flex flex-col focus-within:z-10 hover:z-10"
              >
                {/* Before and after photos */}
                <Link
                  href={compareHref}
                  aria-label={`Open comparison: ${locationOf(comp)}`}
                  className="block overflow-hidden rounded-t-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <PairImages
                    beforeUrl={pairImageUrl(comp.beforeAsset)}
                    afterUrl={pairImageUrl(comp.afterAsset)}
                    beforeDate={comp.beforeAsset.capturedAt}
                    afterDate={comp.afterAsset.capturedAt}
                  />
                </Link>

                <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconChip icon={MapPin} tone="sky" size="sm" />
                    <p className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">
                      {locationOf(comp)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {apart && (
                      <span className="badge badge-blue">
                        <Clock className="h-3 w-3" />
                        {apart}
                      </span>
                    )}
                    <VerifiedBadge verified={comp.verified} />
                    {change && (
                      <span
                        className={cx("badge", change.deltaPp >= 0 ? "badge-green" : "badge-red")}
                        title="Measured change, in percentage points of the photo"
                      >
                        {change.kind === "GREEN_COVER" ? (
                          <Leaf className="h-3 w-3" />
                        ) : (
                          <Droplets className="h-3 w-3" />
                        )}
                        {change.kind === "GREEN_COVER" ? "Green cover" : "Water"} {change.deltaPp > 0 ? "+" : ""}
                        {change.deltaPp} points
                      </span>
                    )}
                  </div>

                  {/* Caption */}
                  {editingCaptionId === comp.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Add a caption"
                        aria-label="Caption"
                        value={captionInput}
                        onChange={(e) => setCaptionInput(e.target.value)}
                        className="input h-8 min-w-0 flex-1 text-[13px]"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={savingCaption}
                        onClick={() => handleSaveCaption(comp.id)}
                        className="btn btn-primary btn-sm"
                      >
                        {savingCaption && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCaptionId(null);
                          setCaptionInput("");
                        }}
                        aria-label="Cancel"
                        className="btn btn-ghost btn-sm btn-icon"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : hasRealCaption ? (
                    <p className="border-l-2 border-emerald-200 pl-3 text-sm leading-relaxed text-zinc-700">
                      {comp.notes}
                    </p>
                  ) : null}

                  {isDetailsExpanded && (
                    <div className="animate-fade-in">
                      <ComparisonDetails comp={comp} pct={pct} />
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <button
                      type="button"
                      onClick={() => toggleDetails(comp.id)}
                      aria-expanded={isDetailsExpanded}
                      className="inline-flex items-center gap-1 rounded text-[13px] text-zinc-500 transition hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                    >
                      Details
                      <ChevronDown className={cx("h-3.5 w-3.5 transition", isDetailsExpanded && "rotate-180")} />
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Menu
                        trigger={<MoreHorizontal className="h-4 w-4" />}
                        buttonClassName="btn btn-ghost btn-sm btn-icon"
                      >
                        <button type="button" className="menu-item" onClick={() => setExpandedComp(comp)}>
                          <Maximize2 className="h-4 w-4 text-zinc-400" />
                          Quick view
                        </button>
                        <button
                          type="button"
                          className="menu-item"
                          onClick={() => {
                            setEditingCaptionId(comp.id);
                            setCaptionInput(hasRealCaption ? comp.notes || "" : "");
                          }}
                        >
                          <Pencil className="h-4 w-4 text-zinc-400" />
                          {hasRealCaption ? "Edit caption" : "Add caption"}
                        </button>
                        <button
                          type="button"
                          className="menu-item text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmDeleteId(comp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </Menu>
                      <Link
                        href={compareHref}
                        title="Measure the change and make a short video"
                        className="btn btn-primary btn-sm"
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Delete one comparison */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (!confirmDeleteId) return;
          await handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        title="Delete this comparison?"
        description="The two photos stay in the project. Only the saved pair is removed."
        busy={deletingId !== null}
      />

      {/* Remove unverified, low-score comparisons */}
      <Modal
        open={showCleanupModal}
        onClose={() => {
          if (!cleaningUp) setShowCleanupModal(false);
        }}
        size="sm"
        icon={Eraser}
        tone="amber"
        title="Clean up unverified comparisons?"
        description="This removes comparisons that weren't confirmed to show the same place and have a match score under 30%. It can't be undone."
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCleanupModal(false)}
              disabled={cleaningUp}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              id="confirm-cleanup-unverified-btn"
              onClick={handleConfirmCleanup}
              disabled={cleaningUp}
              className="btn btn-danger btn-sm"
            >
              {cleaningUp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Remove
            </button>
          </>
        }
      >
        {cleanupFeedback ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
            <Check className="h-4 w-4 shrink-0" />
            {cleanupFeedback}
          </p>
        ) : null}
      </Modal>

      {/* Quick view with the slider */}
      <Modal
        open={Boolean(expandedComp && expandedComp.beforeAsset && expandedComp.afterAsset)}
        onClose={() => setExpandedComp(null)}
        size="xl"
        icon={Columns2}
        title={
          expandedComp ? (
            <span className="flex flex-wrap items-center gap-2">
              {locationOf(expandedComp)}
              <VerifiedBadge verified={expandedComp.verified} />
            </span>
          ) : undefined
        }
        description={
          expandedComp && expandedComp.beforeAsset && expandedComp.afterAsset
            ? [
                `${formatDate(expandedComp.beforeAsset.capturedAt, "Earlier")} → ${formatDate(
                  expandedComp.afterAsset.capturedAt,
                  "Later",
                )}`,
                timeApart(expandedComp.beforeAsset.capturedAt, expandedComp.afterAsset.capturedAt),
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        footer={
          expandedComp && (
            <>
              <button type="button" onClick={() => setExpandedComp(null)} className="btn btn-ghost btn-sm">
                Close
              </button>
              <Link
                href={`/projects/${expandedComp.projectId}/compare/${expandedComp.id}`}
                className="btn btn-primary btn-sm"
              >
                Open comparison
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )
        }
      >
        {expandedComp && expandedComp.beforeAsset && expandedComp.afterAsset && (
          <div className="space-y-4">
            <CompareSlider
              beforeUrl={expandedComp.beforeAsset.normalizedUrl || expandedComp.beforeAsset.secureUrl}
              afterUrl={expandedComp.afterAsset.normalizedUrl || expandedComp.afterAsset.secureUrl}
              beforeDate={expandedComp.beforeAsset.capturedAt}
              afterDate={expandedComp.afterAsset.capturedAt}
              aspectRatio="aspect-[16/9]"
              notes={!isPlaceholderCaption(expandedComp.notes) ? expandedComp.notes : undefined}
            />

            <details className="group rounded-xl border border-zinc-200">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
                Details
                <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-zinc-100 p-3">
                <ComparisonDetails comp={expandedComp} pct={matchPct(expandedComp)} />
              </div>
            </details>
          </div>
        )}
      </Modal>
    </section>
  );
}
