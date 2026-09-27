"use client";

import { useState } from "react";
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
  Sparkles
} from "lucide-react";
import { MediaAssetItem } from "./GalleryGrid";
import { CATEGORIES } from "./GalleryFilterBar";

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

  const [category, setCategory] = useState(asset.manualCategory || "Environmental");
  const [location, setLocation] = useState(asset.manualLocation || "");
  const [notes, setNotes] = useState(asset.manualNotes || "");
  const [capturedAt, setCapturedAt] = useState(
    asset.capturedAt ? asset.capturedAt.split("T")[0] : new Date().toISOString().split("T")[0]
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

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
      onAssetUpdated(data.asset);
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

  const isVideo = asset.resourceType === "video";

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
                Full-resolution CDN preview and verified evidence metadata
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

        {/* Content Body: Left Preview, Right Metadata & Edit Form */}
        <div className="flex-1 overflow-y-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pr-1">
          {/* Left Column: Full Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-black/60 rounded-2xl p-3 border border-white/10 relative overflow-hidden">
            {isVideo ? (
              <video
                controls
                playsInline
                className="max-h-[60vh] w-full rounded-xl object-contain bg-black shadow-2xl"
                src={asset.secureUrl}
              >
                Your browser does not support HTML5 video preview.
              </video>
            ) : (
              <div className="relative w-full flex items-center justify-center">
                <img
                  src={asset.secureUrl}
                  alt={asset.manualNotes || asset.cloudinaryPublicId}
                  className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
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
          </div>

          {/* Right Column: Metadata & Edit Form (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            {/* Technical Metadata Box */}
            <div className="glass-panel rounded-2xl p-4 space-y-2.5 text-xs border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
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
            <form onSubmit={handleSaveChanges} className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                Manual Tags & Metadata
              </h3>

              {saveError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Metadata changes persisted to database successfully!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Domain Category
                </label>
                <select
                  id="asset-detail-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Location Text / GPS Point
                </label>
                <input
                  id="asset-detail-location-input"
                  type="text"
                  placeholder="e.g. Madre de Dios, Plot B"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Date Captured
                </label>
                <input
                  id="asset-detail-date-input"
                  type="date"
                  value={capturedAt}
                  onChange={(e) => setCapturedAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Field Observation Notes
                </label>
                <textarea
                  id="asset-detail-notes-input"
                  rows={3}
                  placeholder="Detailed notes on visible environmental indicators, project progress, or field activity..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                id="save-asset-metadata-btn"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? "Saving Changes..." : "Save Metadata"}</span>
              </button>
            </form>

            {/* Deletion Section */}
            <div className="pt-4 border-t border-white/10">
              {deleteError && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {deleteError}
                </div>
              )}

              {!confirmDelete ? (
                <button
                  type="button"
                  id="trigger-delete-asset-btn"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Asset from Cloudinary & Database</span>
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-red-300 text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Confirm Permanent Deletion?</span>
                  </div>
                  <p className="text-[11px] text-red-300/80">
                    This will call Cloudinary&apos;s destroy API to erase the asset from CDN storage and remove the database record. This cannot be undone.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
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
