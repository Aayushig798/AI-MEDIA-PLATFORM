"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus, Check, ImageIcon, Loader2, MapPin, Maximize2, Play, Upload, X } from "lucide-react";
import { getThumbnailUrl, withTransformation } from "@/lib/cloudinary-url";
import { AiTagItem } from "./AiTagChips";
import { TrustBadge, IntegritySummary } from "./TrustBadge";
import { EmptyState, cx } from "./ui";

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
  claimText?: string | null;
  integrity?: IntegritySummary | null;
}

interface GalleryGridProps {
  assets: MediaAssetItem[];
  onSelectAsset: (asset: MediaAssetItem) => void;
  onOpenUpload: () => void;
  onAssetUpdated?: (updated: MediaAssetItem) => void;
}

const CATEGORY_DOT: Record<string, string> = {
  environmental: "bg-emerald-500",
  infrastructure: "bg-sky-500",
  community: "bg-amber-500",
  "disaster response": "bg-red-500",
};

export function categoryDotClass(category: string | null): string {
  return CATEGORY_DOT[category?.toLowerCase() ?? ""] ?? "bg-zinc-400";
}

export function getCategoryBadgeClasses(category: string | null): string {
  switch (category?.toLowerCase()) {
    case "environmental":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "infrastructure":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "community":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "disaster response":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-zinc-100 text-zinc-600 border-zinc-200";
  }
}

export function GalleryGrid({ assets, onSelectAsset, onOpenUpload, onAssetUpdated }: GalleryGridProps) {
  const [editingDateAssetId, setEditingDateAssetId] = useState<string | null>(null);
  const [selectedDateInput, setSelectedDateInput] = useState<string>("");
  const [savingDate, setSavingDate] = useState(false);

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
      <EmptyState
        icon={ImageIcon}
        title="No media here yet"
        description="Upload photos or videos from the field. Each file is dated, tagged and verified automatically."
        action={
          <button onClick={onOpenUpload} className="btn btn-primary">
            <Upload className="h-4 w-4" />
            Upload media
          </button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset) => {
        const isVideo = asset.resourceType === "video";
        const thumbUrl =
          withTransformation(asset.secureUrl, "c_fill,w_600,h_450,g_auto,q_auto,f_auto", isVideo ? "jpg" : undefined) ||
          getThumbnailUrl(asset.secureUrl, asset.resourceType);
        const isAiPending =
          asset.aiProcessingStatus === "pending" ||
          asset.aiProcessingStatus === "processing";
        const isEditingDate = editingDateAssetId === asset.id;
        const category = asset.manualCategory || "Uncategorized";

        return (
          <div
            key={asset.id}
            id={`asset-card-${asset.id}`}
            onClick={() => onSelectAsset(asset)}
            className="card-interactive group flex cursor-pointer flex-col overflow-hidden"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
              <img
                src={thumbUrl || asset.secureUrl}
                alt={asset.manualNotes || asset.manualLocation || "Project media"}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

              <div className="absolute left-2.5 top-2.5">
                <TrustBadge integrity={asset.integrity} />
              </div>

              <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
                {isVideo && (
                  <span className="photo-chip">
                    <Play className="h-3 w-3 fill-current" />
                    Video
                  </span>
                )}
                {isAiPending && (
                  <span id={`ai-badge-${asset.id}`} className="photo-chip text-violet-700">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analyzing
                  </span>
                )}
              </div>

              {isVideo && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg transition group-hover:scale-110">
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </div>
                </div>
              )}

              <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-white drop-shadow">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-white/80" />
                  <span className="truncate">{asset.manualLocation || "No location"}</span>
                </p>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-zinc-800 opacity-0 shadow-sm transition group-hover:opacity-100">
                  <Maximize2 className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>

            {!isEditingDate ? (
              <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                {asset.capturedAt ? (
                  <span className="flex items-center gap-1.5 text-[13px] text-zinc-600">
                    <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
                    {new Date(asset.capturedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <button
                    type="button"
                    title="Photos need a date to be used in before & after comparisons"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDateAssetId(asset.id);
                      setSelectedDateInput(new Date().toISOString().split("T")[0]);
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[13px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 transition hover:bg-amber-100"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Add date
                  </button>
                )}
                {!isAiPending && (
                  <span
                    id={`category-badge-${asset.id}`}
                    className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-zinc-500"
                    title={asset.categorySource !== "user" ? "Suggested by AI" : undefined}
                  >
                    <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", categoryDotClass(category))} />
                    <span className="truncate">{category}</span>
                  </span>
                )}
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 px-3 py-2.5">
                <input
                  type="date"
                  value={selectedDateInput}
                  onChange={(e) => setSelectedDateInput(e.target.value)}
                  className="input h-8 min-w-0 flex-1 px-2 text-xs"
                />
                <button
                  type="button"
                  disabled={savingDate}
                  aria-label="Save date"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveInlineDate(asset);
                  }}
                  className="btn btn-primary h-8 w-8 shrink-0 px-0"
                >
                  {savingDate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDateAssetId(null);
                  }}
                  className="btn btn-ghost h-8 w-8 shrink-0 px-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
