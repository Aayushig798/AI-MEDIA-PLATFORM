"use client";

import { Video, Image as ImageIcon, MapPin, Calendar, HardDrive, Play } from "lucide-react";
import { getThumbnailUrl } from "@/lib/cloudinary-url";

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
  createdAt: string;
  updatedAt: string;
}

interface GalleryGridProps {
  assets: MediaAssetItem[];
  onSelectAsset: (asset: MediaAssetItem) => void;
  onOpenUpload: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getCategoryColor(category: string | null): string {
  switch (category?.toLowerCase()) {
    case "environmental":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
    case "infrastructure":
      return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
    case "community":
      return "bg-amber-500/10 text-amber-300 border-amber-500/20";
    case "disaster response":
      return "bg-rose-500/10 text-rose-300 border-rose-500/20";
    default:
      return "bg-slate-500/10 text-slate-300 border-slate-500/20";
  }
}

export function GalleryGrid({ assets, onSelectAsset, onOpenUpload }: GalleryGridProps) {
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
              </div>

              {/* Category Badge */}
              {asset.manualCategory && (
                <div className="absolute top-2.5 right-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border backdrop-blur-md ${getCategoryColor(
                      asset.manualCategory
                    )}`}
                  >
                    {asset.manualCategory}
                  </span>
                </div>
              )}

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

                {/* Notes */}
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {asset.manualNotes || "No notes recorded."}
                </p>
              </div>

              {/* Date Footer */}
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {new Date(asset.capturedAt || asset.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
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
