"use client";

import { useState, useEffect } from "react";
import { IntegrityPanel } from "./IntegrityPanel";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Loader2,
  RotateCcw,
  ChevronDown,
  CalendarDays,
  MapPin,
  Tag,
  StickyNote,
  ImageIcon,
  Film,
  Sparkles,
  History,
  NotebookPen,
  Info,
  TriangleAlert,
  Pencil,
} from "lucide-react";
import { MediaAssetItem } from "./GalleryGrid";
import { AiTagChips, AiTagItem } from "./AiTagChips";
import { TraceabilityTimeline } from "./TraceabilityTimeline";
import { ErrorNote, IconChip, Modal, SectionHeader, Tabs, cx, useBodyScrollLock } from "./ui";
import { getThumbnailUrl, withTransformation } from "@/lib/cloudinary-url";

const CATEGORY_OPTIONS = [
  "Environmental",
  "Infrastructure",
  "Community",
  "Disaster Response",
  "Uncategorized",
];

type DetailTab = "overview" | "tags" | "history";

interface AssetDetailModalProps {
  asset: MediaAssetItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAssetUpdated: (updated: MediaAssetItem) => void;
  onAssetDeleted: (deletedId: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Capture dates are stored as UTC days (the form edits the YYYY-MM-DD part), so show them in UTC. */
function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Sharp, large rendition for the viewer; format/quality/fit only. */
const VIEWER_TRANSFORMATION = "c_limit,w_1800,h_1800/f_auto,q_auto";

const GLASS_BASE = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset backdrop-blur-md";
const GLASS_CHIP = `${GLASS_BASE} bg-black/35 text-white/90 ring-white/15`;
const GLASS_CHIP_AMBER = `${GLASS_BASE} bg-amber-500/25 text-amber-100 ring-amber-300/30`;

const SUMMARY_CLS =
  "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50/80 [&::-webkit-details-marker]:hidden";

export function AssetDetailModal(props: AssetDetailModalProps) {
  if (!props.isOpen || !props.asset) return null;
  // Keyed inner component so hooks never run conditionally and state resets per asset.
  return <AssetDetailContent key={props.asset.id} {...props} asset={props.asset} />;
}

function AssetDetailContent({
  asset,
  isOpen,
  onClose,
  onAssetUpdated,
  onAssetDeleted,
}: AssetDetailModalProps & { asset: MediaAssetItem }) {
  useBodyScrollLock(true);

  const [category, setCategory] = useState(asset.manualCategory || "Uncategorized");
  const [categorySource, setCategorySource] = useState(asset.categorySource || "ai");
  const [resettingAi, setResettingAi] = useState(false);
  const [location, setLocation] = useState(asset.manualLocation || "");
  const [notes, setNotes] = useState(asset.manualNotes || "");
  const [capturedAt, setCapturedAt] = useState(
    asset.capturedAt ? asset.capturedAt.split("T")[0] : ""
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const [aiTags, setAiTags] = useState<AiTagItem[]>(asset.aiTags || []);
  const [aiStatus, setAiStatus] = useState<string>(asset.aiProcessingStatus || "done");

  const [tab, setTab] = useState<DetailTab>("overview");

  const currentAsset = asset;

  // Sync state when asset prop changes
  useEffect(() => {
    if (asset) {
      setCategory(asset.manualCategory || "Uncategorized");
      setCategorySource(asset.categorySource || "ai");
      setLocation(asset.manualLocation || "");
      setNotes(asset.manualNotes || "");
      setCapturedAt(
        asset.capturedAt ? asset.capturedAt.split("T")[0] : ""
      );
      setAiTags(asset.aiTags || []);
      setAiStatus(asset.aiProcessingStatus || "done");
    }
  }, [asset]);

  // Load fresh tags directly from the AiTag table via /api/assets/[id]/ai-tags
  useEffect(() => {
    let isMounted = true;
    async function fetchFreshAiTags() {
      try {
        const res = await fetch(`/api/assets/${currentAsset.id}/ai-tags`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.aiTags)) {
            setAiTags(data.aiTags);
            if (data.aiProcessingStatus) {
              setAiStatus(data.aiProcessingStatus);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to load fresh AI tags for asset ${currentAsset.id}:`, err);
      }
    }
    fetchFreshAiTags();
    return () => {
      isMounted = false;
    };
  }, [currentAsset.id]);

  // Close on Escape (like the shared Modal); the delete confirmation handles its own Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmDelete) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmDelete]);

  const handleCopy = (text: string, type: "url" | "id") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setCategorySource("user");
  };

  const handleResetToAi = async () => {
    try {
      setResettingAi(true);
      setSaveError("");
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToAi: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reset category");
      }
      setCategory(data.asset.manualCategory || "Uncategorized");
      setCategorySource("ai");
      onAssetUpdated({ ...data.asset, aiTags, aiProcessingStatus: aiStatus });
    } catch (err: any) {
      setSaveError(err.message || "Failed to reset to AI suggestion");
    } finally {
      setResettingAi(false);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualCategory: category,
          categorySource: categorySource,
          manualLocation: location,
          manualNotes: notes,
          capturedAt: capturedAt ? new Date(capturedAt).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update asset metadata");
      }

      setSaveSuccess(true);
      onAssetUpdated({ ...data.asset, aiTags, aiProcessingStatus: aiStatus });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async () => {
    try {
      setDeleting(true);
      setDeleteError("");

      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete asset from Cloudinary and database");
      }

      onAssetDeleted(asset.id);
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || "Deletion failed");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleTagDeleted = (deletedTagId: string) => {
    const updated = aiTags.filter((t) => t.id !== deletedTagId);
    setAiTags(updated);
    onAssetUpdated({ ...asset, aiTags: updated, aiProcessingStatus: aiStatus });
  };

  const handleReanalyzed = (updatedTags: AiTagItem[], newStatus: string) => {
    setAiTags(updatedTags);
    setAiStatus(newStatus);
    onAssetUpdated({ ...asset, aiTags: updatedTags, aiProcessingStatus: newStatus });
  };

  const isVideo = asset.resourceType === "video";
  const noun = isVideo ? "video" : "photo";
  const isUserCategory = categorySource === "user";
  const aiPending = aiStatus === "pending" || aiStatus === "processing";

  const aiStatusBadge =
    aiStatus === "done"
      ? { cls: "badge-neutral", label: "Complete" }
      : aiStatus === "failed"
        ? { cls: "badge-red", label: "Failed" }
        : { cls: "badge-violet", label: "In progress" };

  // Presentational: large viewer image (falls back to the original if the rendition fails) + load state.
  const isCloudinary = asset.secureUrl.includes("res.cloudinary.com");
  const [imgSrc, setImgSrc] = useState(() => withTransformation(asset.secureUrl, VIEWER_TRANSFORMATION));
  const [imgLoaded, setImgLoaded] = useState(false);
  const ambientUrl = !isVideo || isCloudinary ? getThumbnailUrl(asset.secureUrl, asset.resourceType) : null;
  const posterUrl = isVideo && isCloudinary ? withTransformation(asset.secureUrl, "c_limit,w_1600/q_auto", "jpg") : undefined;

  const title = asset.manualLocation?.trim() || `${isVideo ? "Video" : "Photo"} details`;
  const dirty =
    category !== (asset.manualCategory || "Uncategorized") ||
    location !== (asset.manualLocation || "") ||
    notes !== (asset.manualNotes || "") ||
    capturedAt !== (asset.capturedAt ? asset.capturedAt.split("T")[0] : "");

  return (
    <>
      <div
        className="fixed inset-0 z-50 !mt-0 flex items-start justify-center overflow-y-auto bg-zinc-950/60 p-3 sm:items-center sm:p-6"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${isVideo ? "Video" : "Photo"} details`}
          className="animate-fade-in relative my-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 lg:grid lg:h-[min(88vh,880px)] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-1"
        >
          <button
            type="button"
            id="close-asset-detail-btn"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 rounded-lg bg-black/40 p-1.5 text-white ring-1 ring-inset ring-white/15 backdrop-blur-md transition hover:bg-black/60 lg:bg-transparent lg:text-zinc-400 lg:ring-0 lg:backdrop-blur-none lg:hover:bg-zinc-100 lg:hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Media stage */}
          <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-zinc-950 lg:h-full lg:min-h-0">
            {ambientUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ambientUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,9,11,0.15),rgba(9,9,11,0.85))]" />

            <div className="relative z-[1] flex h-full w-full items-center justify-center px-4 pb-5 pt-14 sm:px-6 lg:px-10 lg:pb-10 lg:pt-16">
              {isVideo ? (
                <video
                  controls
                  playsInline
                  poster={posterUrl}
                  className="relative max-h-[62vh] w-full rounded-lg bg-black object-contain shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] lg:max-h-full"
                  src={asset.secureUrl}
                >
                  Your browser does not support HTML5 video preview.
                </video>
              ) : (
                <>
                  {!imgLoaded && <Loader2 className="absolute h-6 w-6 animate-spin text-white/40" />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={asset.manualNotes || asset.cloudinaryPublicId}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => {
                      if (imgSrc !== asset.secureUrl) setImgSrc(asset.secureUrl);
                      else setImgLoaded(true);
                    }}
                    className={cx(
                      "relative max-h-[62vh] w-auto max-w-full rounded-lg object-contain shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] transition-opacity duration-300 lg:max-h-full",
                      imgLoaded ? "opacity-100" : "opacity-0",
                    )}
                  />
                </>
              )}
            </div>

            {/* Overlay chips + original link */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-24 bg-gradient-to-b from-black/50 to-transparent" />
            <div className="absolute inset-x-0 top-0 z-[3] flex items-start justify-between gap-2 p-3 pr-14 sm:p-4 sm:pr-14 lg:pr-4">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={GLASS_CHIP}>
                  {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                  {isVideo ? "Video" : "Photo"} · {asset.format.toUpperCase()}
                </span>
                {asset.capturedAt ? (
                  <span className={GLASS_CHIP} title="Date taken">
                    <CalendarDays className="h-3 w-3" />
                    Taken {formatDay(asset.capturedAt)}
                  </span>
                ) : (
                  <span className={GLASS_CHIP_AMBER} title="Add a date in Details">
                    <CalendarDays className="h-3 w-3" />
                    No date
                  </span>
                )}
                {asset.exifLat && asset.exifLng ? (
                  <span className={GLASS_CHIP} title={`GPS from the ${noun}`}>
                    <MapPin className="h-3 w-3" />
                    GPS
                  </span>
                ) : null}
              </div>
              <a
                href={asset.secureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-glass btn-sm shrink-0"
                title={`Open the original ${noun} in a new tab`}
              >
                <span className="hidden sm:inline">Open original</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Side panel */}
          <div className="flex min-w-0 flex-col bg-white lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-zinc-200/80">
            <div className="space-y-4 px-5 pt-5 sm:px-6 lg:pr-14">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium text-emerald-700">{isVideo ? "Video" : "Photo"} evidence</p>
                  <span className="badge badge-neutral">{asset.manualCategory || "Uncategorized"}</span>
                </div>
                <h2 className="flex items-start gap-2 text-xl font-semibold leading-snug tracking-tight text-zinc-900">
                  {asset.manualLocation?.trim() && <MapPin className="mt-1 h-4 w-4 shrink-0 text-sky-600" />}
                  <span className="min-w-0 break-words">{title}</span>
                </h2>
                <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-zinc-500">
                  <span>Uploaded {formatDate(asset.createdAt)}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{formatBytes(asset.bytes)}</span>
                </p>
              </div>

              <IntegrityPanel
                assetId={asset.id}
                initial={asset.integrity}
                initialClaim={asset.claimText}
                onVerified={(integrity) => onAssetUpdated({ ...asset, integrity })}
              />
            </div>

            <div className="z-10 mt-5 border-b border-zinc-100 bg-white/90 px-5 py-3 backdrop-blur sm:px-6 lg:sticky lg:top-0">
              <Tabs<DetailTab>
                value={tab}
                onChange={setTab}
                items={[
                  { value: "overview", label: "Details", icon: NotebookPen },
                  { value: "tags", label: "AI tags", count: aiTags.length, icon: Sparkles },
                  { value: "history", label: "History", icon: History },
                ]}
              />
            </div>

            <div className="px-5 py-5 sm:px-6 lg:flex-1">
              {/* Details: editable fields, technical info, delete */}
              <div className={tab === "overview" ? "space-y-6" : "hidden"}>
                <form onSubmit={handleSaveChanges} className="space-y-4">
                  <SectionHeader
                    title={`About this ${noun}`}
                    description="Used to sort, compare and report on your evidence."
                    icon={NotebookPen}
                    tone="zinc"
                  />

                  <div className="space-y-4 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4">
                    <div>
                      <label htmlFor="asset-detail-date-input" className="label flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
                        Date taken
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="asset-detail-date-input"
                          type="date"
                          value={capturedAt}
                          onChange={(e) => setCapturedAt(e.target.value)}
                          className="input min-w-0 flex-1"
                        />
                        {capturedAt && (
                          <button
                            type="button"
                            onClick={() => setCapturedAt("")}
                            className="btn btn-ghost btn-sm shrink-0"
                            title="Clear date"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {capturedAt ? (
                        <p className="mt-1.5 text-xs text-zinc-500">Used to order {noun}s in before/after comparisons.</p>
                      ) : (
                        <p className="mt-1.5 flex items-start gap-1 text-xs text-amber-700">
                          <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
                          Add a date to use this {noun} in before/after comparisons.
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="asset-detail-location-input" className="label flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-sky-600" />
                        Location
                      </label>
                      <input
                        id="asset-detail-location-input"
                        type="text"
                        placeholder="e.g. Madre de Dios, Plot B"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="input"
                      />
                      {asset.exifLat && asset.exifLng && (
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                          <span className="badge badge-blue">
                            <MapPin className="h-3 w-3" />
                            GPS from the {noun}
                          </span>
                          <span className="tabular-nums">
                            {asset.exifLat.toFixed(4)}, {asset.exifLng.toFixed(4)}
                          </span>
                          <a
                            href={`https://maps.google.com/?q=${asset.exifLat},${asset.exifLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 font-medium text-sky-700 underline-offset-2 hover:text-sky-800 hover:underline"
                          >
                            View on map
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label
                          htmlFor="asset-detail-category-select"
                          className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-700"
                        >
                          <Tag className="h-3.5 w-3.5 text-zinc-400" />
                          Category
                        </label>
                        <div className="flex items-center gap-2">
                          <span
                            id="asset-detail-form-source-badge"
                            className={cx("badge", isUserCategory ? "badge-neutral" : "badge-violet")}
                          >
                            {isUserCategory ? <Pencil className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                            {isUserCategory ? "Edited by you" : "Suggested by AI"}
                          </span>
                          {isUserCategory && (
                            <button
                              type="button"
                              id="asset-detail-form-reset-ai-btn"
                              onClick={handleResetToAi}
                              disabled={resettingAi}
                              className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 transition hover:text-violet-900 disabled:opacity-50"
                              title="Reset category to AI suggestion"
                            >
                              <RotateCcw className={cx("h-3 w-3", resettingAi && "animate-spin")} />
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <select
                        id="asset-detail-category-select"
                        value={category}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="input"
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="asset-detail-notes-input" className="label flex items-center gap-1.5">
                        <StickyNote className="h-3.5 w-3.5 text-zinc-400" />
                        Notes
                      </label>
                      <textarea
                        id="asset-detail-notes-input"
                        rows={3}
                        placeholder={`What does this ${noun} show?`}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>

                  {saveError && <ErrorNote>{saveError}</ErrorNote>}

                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-[13px]" aria-live="polite">
                      {saveSuccess ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                            <Check className="h-3 w-3" />
                          </span>
                          Saved
                        </span>
                      ) : dirty ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Unsaved changes
                        </span>
                      ) : (
                        <span className="text-zinc-400">All changes saved</span>
                      )}
                    </p>
                    <button type="submit" id="save-asset-metadata-btn" disabled={saving} className="btn btn-primary shrink-0">
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>

                <details className="group overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
                  <summary className={SUMMARY_CLS}>
                    <span className="flex items-center gap-3">
                      <IconChip icon={Info} tone="zinc" size="sm" />
                      Technical details
                    </span>
                    <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="space-y-3.5 border-t border-zinc-100 px-4 py-3.5">
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-[13px]">
                      <dt className="text-zinc-500">Type</dt>
                      <dd className="text-zinc-900">
                        <span className="capitalize">{asset.resourceType}</span> · {asset.format.toUpperCase()}
                      </dd>
                      <dt className="text-zinc-500">File size</dt>
                      <dd className="tabular-nums text-zinc-900">{formatBytes(asset.bytes)}</dd>
                      {asset.width ? (
                        <>
                          <dt className="text-zinc-500">Dimensions</dt>
                          <dd className="tabular-nums text-zinc-900">
                            {asset.width} × {asset.height} px
                          </dd>
                        </>
                      ) : null}
                      <dt className="text-zinc-500">Uploaded</dt>
                      <dd className="text-zinc-900">{formatDate(asset.createdAt)}</dd>
                      <dt className="text-zinc-500">File ID</dt>
                      <dd className="break-all font-mono text-xs text-zinc-700">{asset.cloudinaryPublicId}</dd>
                      <dt className="text-zinc-500">Link</dt>
                      <dd className="truncate font-mono text-xs text-zinc-700" title={asset.secureUrl}>
                        {asset.secureUrl}
                      </dd>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(asset.secureUrl, "url")}
                        className="btn btn-secondary btn-sm"
                      >
                        {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedUrl ? "Copied" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(asset.cloudinaryPublicId, "id")}
                        className="btn btn-secondary btn-sm"
                      >
                        {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId ? "Copied" : "Copy file ID"}
                      </button>
                    </div>
                  </div>
                </details>

                <div className="space-y-3 border-t border-zinc-100 pt-5">
                  {deleteError && <ErrorNote>{deleteError}</ErrorNote>}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">Delete this {noun}</p>
                      <p className="text-xs text-zinc-500">Removes the file and its details for good.</p>
                    </div>
                    <button
                      type="button"
                      id="trigger-delete-asset-btn"
                      onClick={() => setConfirmDelete(true)}
                      className="btn btn-secondary btn-sm text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete {noun}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI tags */}
              <div className={tab === "tags" ? "space-y-6" : "hidden"}>
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 via-white to-white p-4 ring-1 ring-inset ring-violet-100">
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(rgba(124,58,237,0.10)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_left,black,transparent)]" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconChip icon={Sparkles} tone="violet" />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900">AI analysis</h3>
                        <p className="text-xs text-zinc-500">Suggested from what the AI sees in the {noun}.</p>
                      </div>
                    </div>
                    <span id="ai-processing-status-badge" className={cx("badge shrink-0", aiStatusBadge.cls)}>
                      {aiPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      {aiStatus === "done" && <Check className="h-3 w-3" />}
                      {aiStatusBadge.label}
                    </span>
                  </div>
                  <div className="relative mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-inset ring-zinc-200/70">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                      <Tag className="h-3.5 w-3.5" />
                      Category
                    </span>
                    <span
                      id="asset-detail-category-badge"
                      className={cx("badge", isUserCategory ? "badge-neutral" : "badge-violet")}
                    >
                      {category || "Uncategorized"}
                    </span>
                    <span id="asset-detail-ai-category-source-badge" className="text-xs text-zinc-500">
                      {isUserCategory ? "Edited by you" : "Suggested by AI"}
                    </span>
                    {isUserCategory && (
                      <button
                        type="button"
                        id="reset-to-ai-category-btn-top"
                        onClick={handleResetToAi}
                        disabled={resettingAi}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-violet-700 transition hover:text-violet-900 disabled:opacity-50"
                      >
                        <RotateCcw className={cx("h-3 w-3", resettingAi && "animate-spin")} />
                        Use AI suggestion
                      </button>
                    )}
                  </div>
                </section>

                <AiTagChips
                  assetId={asset.id}
                  tags={aiTags}
                  processingStatus={aiStatus}
                  onTagDeleted={handleTagDeleted}
                  onReanalyzed={handleReanalyzed}
                />
              </div>

              {/* History */}
              <div className={tab === "history" ? "" : "hidden"}>
                <TraceabilityTimeline assetId={asset.id} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        size="sm"
        icon={Trash2}
        tone="red"
        title={`Delete this ${noun}?`}
        description="The file and its details are removed permanently. This can't be undone."
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              id="confirm-delete-asset-btn"
              className="btn btn-danger btn-sm"
              onClick={handleDeleteAsset}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      />
    </>
  );
}
