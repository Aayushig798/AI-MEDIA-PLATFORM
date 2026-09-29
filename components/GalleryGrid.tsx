"use client";

import { useState } from "react";
import { 
  Video, 
  Image as ImageIcon, 
  MapPin, 
  Calendar, 
  Play, 
  Sparkles, 
  Navigation, 
  Loader2,
  AlertTriangle,
  Check,
  X
} from "lucide-react";
import { getThumbnailUrl } from "@/lib/cloudinary-url";
import { AiTagItem } from "./AiTagChips";

export interface MediaAssetItem {
  id: string;
  projectId: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  resourceType: string;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  manualCategory: string | null;
  manualLocation: string | null;
  manualNotes: string | null;
  capturedAt: string | null;
  uploadedBy: string;
  categorySource?: string;
  exifLat?: number | null;
  exifLng?: number | null;
  aiProcessingStatus?: string; // "pending" | "processing" | "done" | "failed"
  aiTags?: AiTagItem[];
  categories?: { category?: { id: string; name: string }; name?: string }[];
  createdAt: string;
  updatedAt: string;
}

interface GalleryGridProps {
  assets: MediaAssetItem[];
  onSelectAsset: (asset: MediaAssetItem) => void;
  onOpenUpload: () => void;
  onAssetUpdated?: (updated: MediaAssetItem) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getCategoryBadgeClasses(category: string | null): string {
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

export function GalleryGrid({ assets, onSelectAsset, onOpenUpload, onAssetUpdated }: GalleryGridProps) {
  const [editingDateAssetId, setEditingDateAssetId] = useState<string | null>(null);
  const [selectedDateInput, setSelectedDateInput] = useState<string>("");
  const [savingDate, setSavingDate] = useState(false);
  const [activeTagPopoverId, setActiveTagPopoverId] = useState<string | null>(null);

  const handleSaveInlineDate = async (asset: MediaAssetItem) => {
    if (!selectedDateInput) return;
    try {
      setSavingDate(true);
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capturedAt: new Date(selectedDateInput).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update capture date");
      }
      setEditingDateAssetId(null);
      if (onAssetUpdated) {
        onAssetUpdated({ ...asset, capturedAt: data.asset.capturedAt });
      }
    } catch (err: any) {
      alert(err.message || "Failed to save capture date");
    } finally {
      setSavingDate(false);
    }
  };

  if (assets.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-16 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-4">
          <ImageIcon className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white">No evidence assets found</h3>
        <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
          No media matches the selected filters or this project currently has no visual records.
          Upload photos and videos directly from the field.
        </p>
        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
        >
          <span>Upload Project Media</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {assets.map((asset) => {
        const thumbUrl = getThumbnailUrl(asset.secureUrl, asset.resourceType);
        const isVideo = asset.resourceType === "video";
        const isAiPending =
          asset.aiProcessingStatus === "pending" ||
          asset.aiProcessingStatus === "processing";

        return (
          <div
            key={asset.id}
            id={`asset-card-${asset.id}`}
            onClick={() => onSelectAsset(asset)}
            className="group glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col border border-white/5 hover:border-emerald-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10"
          >
            {/* Thumbnail Container */}
            <div className="relative aspect-square w-full bg-slate-950 overflow-hidden">
              {/* Image / Video Poster */}
              <img
                src={thumbUrl || asset.secureUrl}
                alt={asset.manualNotes || asset.cloudinaryPublicId}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />

              {/* Resource Type Badge */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur-md text-slate-100 border border-white/10 uppercase">
                  {isVideo ? <Video className="w-3 h-3 text-cyan-400" /> : <ImageIcon className="w-3 h-3 text-emerald-400" />}
                  {asset.format || (isVideo ? "MP4" : "JPG")}
                </span>

                {/* GPS EXIF indicator */}
                {asset.exifLat && asset.exifLng && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-md"
                    title={`GPS: ${asset.exifLat.toFixed(4)}, ${asset.exifLng.toFixed(4)}`}
                  >
                    <Navigation className="w-2.5 h-2.5" />
                    GPS
                  </span>
                )}
              </div>

              {/* Category Badge on top right */}
              <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
                {isAiPending ? (
                  <span
                    id={`ai-badge-${asset.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md animate-pulse"
                  >
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  <span
                    id={`category-badge-${asset.id}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border backdrop-blur-md ${getCategoryBadgeClasses(
                      asset.manualCategory || "Uncategorized"
                    )}`}
                  >
                    {asset.categorySource !== "user" && <Sparkles className="w-2.5 h-2.5" />}
                    {asset.manualCategory || "Uncategorized"}
                  </span>
                )}
              </div>

              {/* Video Play Overlay */}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <Play className="w-4 h-4 ml-0.5 fill-current text-cyan-400" />
                  </div>
                </div>
              )}

              {/* Dimensions & Size overlay on bottom */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-6 flex items-center justify-between text-[10px] text-slate-300">
                <span>{formatBytes(asset.bytes)}</span>
                {asset.width && asset.height && (
                  <span>
                    {asset.width} &times; {asset.height}
                  </span>
                )}
              </div>
            </div>

            {/* Content Details */}
            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div>
                {/* Location text */}
                {asset.manualLocation ? (
                  <div className="flex items-center gap-1 text-[11px] text-teal-400 font-medium truncate mb-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{asset.manualLocation}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic mb-1">Location not set</div>
                )}

                {/* Notes (Only rendered when note actually exists) */}
                {asset.manualNotes && asset.manualNotes.trim() && (
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {asset.manualNotes}
                  </p>
                )}

                {/* Missing Capture Date Warning Badge with one-click Set Date */}
                {!asset.capturedAt && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col gap-1.5 text-[11px] text-amber-300"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 font-medium leading-tight">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>No capture date — comparisons unavailable</span>
                      </span>
                      {editingDateAssetId !== asset.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDateAssetId(asset.id);
                            setSelectedDateInput(new Date().toISOString().split("T")[0]);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[10px] shrink-0 border border-amber-500/40 transition"
                        >
                          Set date
                        </button>
                      )}
                    </div>

                    {editingDateAssetId === asset.id && (
                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-amber-500/20">
                        <input
                          type="date"
                          value={selectedDateInput}
                          onChange={(e) => setSelectedDateInput(e.target.value)}
                          className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          disabled={savingDate}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveInlineDate(asset);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 transition"
                        >
                          {savingDate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDateAssetId(null);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-white transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Tags Preview Pill Stream with +N overflow popover */}
                {asset.aiTags && asset.aiTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-2.5 relative">
                    {asset.aiTags.slice(0, 3).map((t) => (
                      <span
                        key={t.id || t.label}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300 font-mono"
                      >
                        #{t.label}
                      </span>
                    ))}
                    {asset.aiTags.length > 3 && (
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTagPopoverId(
                              activeTagPopoverId === asset.id ? null : asset.id
                            );
                          }}
                          onMouseEnter={() => setActiveTagPopoverId(asset.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 font-mono transition"
                          title="Click to view all tags"
                        >
                          +{asset.aiTags.length - 3}
                        </button>
                        {activeTagPopoverId === asset.id && (
                          <div
                            onMouseLeave={() => setActiveTagPopoverId(null)}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-full left-0 mb-1.5 z-30 p-2.5 rounded-xl bg-slate-900/95 border border-white/15 shadow-2xl backdrop-blur-md flex flex-wrap gap-1 w-48 animate-fade-in"
                          >
                            <div className="w-full text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              All Tags ({asset.aiTags.length})
                            </div>
                            {asset.aiTags.slice(3).map((t) => (
                              <span
                                key={t.id || t.label}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-200 font-mono"
                              >
                                #{t.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date Footer */}
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {asset.capturedAt ? (
                    <span>
                      {new Date(asset.capturedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">No date</span>
                  )}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold group-hover:underline">
                  Inspect &rarr;
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
