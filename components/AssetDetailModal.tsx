"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  Save, 
  Video, 
  Image as ImageIcon, 
  MapPin, 
  Calendar, 
  HardDrive, 
  ShieldAlert, 
  Loader2,
  FileText,
  Layers,
  Sparkles,
  Navigation,
  RotateCcw
} from "lucide-react";
import { MediaAssetItem } from "./GalleryGrid";
import { AiTagChips, AiTagItem } from "./AiTagChips";
import { TraceabilityTimeline } from "./TraceabilityTimeline";

const CATEGORY_OPTIONS = [
  "Environmental",
  "Infrastructure",
  "Community",
  "Disaster Response",
  "Uncategorized",
];

function getCategoryBadgeClasses(category: string | null): string {
  switch (category?.toLowerCase()) {
    case "environmental":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "infrastructure":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    case "community":
      return "bg-amber-500/15 text-amber-200 border-amber-500/30";
    case "disaster response":
      return "bg-rose-500/15 text-rose-200 border-rose-500/30";
    default:
      return "bg-slate-700/40 text-slate-200 border-slate-600/40";
  }
}

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

export function AssetDetailModal({
  asset,
  isOpen,
  onClose,
  onAssetUpdated,
  onAssetDeleted,
}: AssetDetailModalProps) {
  if (!isOpen || !asset) return null;

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
  const primaryAiCategory =
    asset.categories?.[0]?.category?.name ||
    asset.categories?.[0]?.name ||
    "Environmental";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="glass-dropdown w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-white/10 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              {isVideo ? <Video className="w-5 h-5 text-cyan-400" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Asset Evidence Inspector</h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                  {asset.format}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {asset.resourceType}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-resolution CDN preview, automated AI tagging, and verified metadata
              </p>
            </div>
          </div>

          <button
            id="close-asset-detail-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body: Left Preview, Right Metadata & AI Panel */}
        <div className="flex-1 overflow-y-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pr-1">
          {/* Left Column: Full Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-black/60 rounded-2xl p-3 border border-white/10 relative overflow-hidden">
            {isVideo ? (
              <video
                controls
                playsInline
                className="max-h-[58vh] w-full rounded-xl object-contain bg-black shadow-2xl"
                src={asset.secureUrl}
              >
                Your browser does not support HTML5 video preview.
              </video>
            ) : (
              <div className="relative w-full flex items-center justify-center">
                <img
                  src={asset.secureUrl}
                  alt={asset.manualNotes || asset.cloudinaryPublicId}
                  className="max-h-[58vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                />
              </div>
            )}

            {/* CDN URL Bar under preview */}
            <div className="w-full mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-xs font-mono text-[11px] text-slate-400" title={asset.secureUrl}>
                {asset.secureUrl}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(asset.secureUrl, "url")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] transition"
                >
                  {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl ? "Copied" : "Copy URL"}</span>
                </button>
                <a
                  href={asset.secureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open</span>
                </a>
              </div>
            </div>

            {/* Media Provenance & Lifecycle Traceability Timeline */}
            <div className="w-full mt-4 pt-4 border-t border-white/10">
              <TraceabilityTimeline assetId={asset.id} />
            </div>
          </div>

          {/* Right Column: AI Analysis, Metadata & Edit Form (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
            {/* Visual Analysis & Classification Panel */}
            <div className="glass-panel rounded-2xl p-4 space-y-3 border border-emerald-500/20 bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Understanding & Category</span>
                </div>
                <span
                  id="ai-processing-status-badge"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    aiStatus === "done"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : aiStatus === "failed"
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                  }`}
                >
                  {aiStatus.toUpperCase()}
                </span>
              </div>

              {/* Dominant Category Badge */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Category:</span>
                  <span
                    id="asset-detail-category-badge"
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${getCategoryBadgeClasses(
                      category
                    )}`}
                  >
                    {category || "Uncategorized"}
                  </span>
                  <span
                    id="asset-detail-ai-category-source-badge"
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                      categorySource === "user"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {categorySource === "user" ? "Edited by you" : "AI"}
                  </span>
                </div>
                {categorySource === "user" && (
                  <button
                    type="button"
                    id="reset-to-ai-category-btn-top"
                    onClick={handleResetToAi}
                    disabled={resettingAi}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3 h-3 ${resettingAi ? "animate-spin" : ""}`} />
                    <span>Reset to AI suggestion</span>
                  </button>
                )}
              </div>

              {/* EXIF GPS Display if present */}
              {asset.exifLat && asset.exifLng && (
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold">EXIF GPS Location</span>
                      <span className="font-mono text-emerald-300">
                        {asset.exifLat.toFixed(4)}°, {asset.exifLng.toFixed(4)}°
                      </span>
                    </div>
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${asset.exifLat},${asset.exifLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-teal-400 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <span>Map</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              )}

              {/* AI Tag Chips with Rejection & Re-analyze Controls */}
              <AiTagChips
                assetId={asset.id}
                tags={aiTags}
                processingStatus={aiStatus}
                onTagDeleted={handleTagDeleted}
                onReanalyzed={handleReanalyzed}
              />
            </div>

            {/* Technical Metadata Box */}
            <div className="glass-panel rounded-2xl p-4 space-y-2 text-xs border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Cloudinary Asset Metadata
              </h3>
              
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Cloudinary Public ID</span>
                  <span className="font-mono text-[11px] text-emerald-300 break-all">{asset.cloudinaryPublicId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">File Size & Dimensions</span>
                  <span>{formatBytes(asset.bytes)} {asset.width ? `(${asset.width}×${asset.height})` : ""}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Resource Type / Format</span>
                  <span className="capitalize">{asset.resourceType} &bull; {asset.format.toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Recorded / Ingested</span>
                  <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Editable Manual Tags Form */}
            <form onSubmit={handleSaveChanges} className="space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                Category & Metadata
              </h3>

              {saveError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Metadata changes persisted successfully!</span>
                </div>
              )}

              {/* Prominent Date Taken Card */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>Date taken (Capture Date)</span>
                  </label>
                  {capturedAt ? (
                    <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Capture date set
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                      No capture date — comparisons unavailable
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="asset-detail-date-input"
                    type="date"
                    value={capturedAt}
                    onChange={(e) => setCapturedAt(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                  {capturedAt && (
                    <button
                      type="button"
                      onClick={() => setCapturedAt("")}
                      className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 transition"
                      title="Clear date"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Field capture timestamp used for chronological ordering in before/after comparisons.
                </p>
              </div>

              {/* Category & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-medium text-slate-300">
                        Category
                      </label>
                      <span
                        id="asset-detail-form-source-badge"
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                          categorySource === "user"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {categorySource === "user" ? "Edited by you" : "AI"}
                      </span>
                    </div>
                    {categorySource === "user" && (
                      <button
                        type="button"
                        id="asset-detail-form-reset-ai-btn"
                        onClick={handleResetToAi}
                        disabled={resettingAi}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 disabled:opacity-50"
                        title="Reset category to AI suggestion"
                      >
                        <RotateCcw className={`w-2.5 h-2.5 ${resettingAi ? "animate-spin" : ""}`} />
                        <span>Reset to AI</span>
                      </button>
                    )}
                  </div>
                  <select
                    id="asset-detail-category-select"
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Location Text / GPS Point
                  </label>
                  <input
                    id="asset-detail-location-input"
                    type="text"
                    placeholder="e.g. Madre de Dios, Plot B"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Field Observation Notes
                </label>
                <textarea
                  id="asset-detail-notes-input"
                  rows={2}
                  placeholder="Detailed notes on visible environmental indicators, project progress, or field activity..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                id="save-asset-metadata-btn"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saving ? "Saving Changes..." : "Save Metadata"}</span>
              </button>
            </form>

            {/* Deletion Section */}
            <div className="pt-3 border-t border-white/10">
              {deleteError && (
                <div className="mb-2.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {deleteError}
                </div>
              )}

              {!confirmDelete ? (
                <button
                  type="button"
                  id="trigger-delete-asset-btn"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Asset from Cloudinary & Database</span>
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-red-300 text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Confirm Permanent Deletion?</span>
                  </div>
                  <p className="text-[11px] text-red-300/80">
                    This calls Cloudinary&apos;s destroy API to permanently erase the asset from CDN storage and remove the database record.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      id="confirm-delete-asset-btn"
                      onClick={handleDeleteAsset}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-md disabled:opacity-50"
                    >
                      {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{deleting ? "Destroying..." : "Yes, Permanently Delete"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
