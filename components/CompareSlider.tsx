"use client";

import { useState } from "react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
  ReactCompareSliderHandle,
} from "react-compare-slider";
import { getNormalizedComparisonUrl } from "@/lib/cloudinary-url";
import { Calendar, MapPin, Sparkles, Layers, SlidersHorizontal } from "lucide-react";

export interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeDate?: string | Date | null;
  afterDate?: string | Date | null;
  location?: string | null;
  title?: string;
  notes?: string | null;
  aspectRatio?: string; // e.g. "aspect-[4/3]" or "aspect-[16/9]"
}

export function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
  beforeDate,
  afterDate,
  location,
  title,
  notes,
  aspectRatio = "aspect-[16/10]",
}: CompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  const normalizedBefore = getNormalizedComparisonUrl(beforeUrl, 1000, 625);
  const normalizedAfter = getNormalizedComparisonUrl(afterUrl, 1000, 625);

  const formatShortDate = (dateVal?: string | Date | null) => {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formattedBeforeDate = formatShortDate(beforeDate);
  const formattedAfterDate = formatShortDate(afterDate);

  return (
    <div className="flex flex-col gap-3">
      {/* Header Info */}
      {(title || location || notes) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <h4 className="text-sm font-bold text-white tracking-tight">{title}</h4>}
            {location && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {location}
              </p>
            )}
            {notes && <p className="text-xs text-slate-300 mt-1 italic leading-relaxed">&ldquo;{notes}&rdquo;</p>}
          </div>

          {/* Quick preset positions */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10 text-[11px]">
            <button
              type="button"
              onClick={() => setSliderPosition(25)}
              className={`px-2 py-0.5 rounded-lg transition ${sliderPosition === 25 ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400 hover:text-white"}`}
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(50)}
              className={`px-2 py-0.5 rounded-lg transition ${sliderPosition === 50 ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400 hover:text-white"}`}
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(75)}
              className={`px-2 py-0.5 rounded-lg transition ${sliderPosition === 75 ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400 hover:text-white"}`}
            >
              75%
            </button>
          </div>
        </div>
      )}

      {/* Comparison Slider Container */}
      <div className={`relative w-full ${aspectRatio} rounded-2xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl group select-none`}>
        <ReactCompareSlider
          key={sliderPosition}
          defaultPosition={sliderPosition}
          className="w-full h-full"
          handle={
            <ReactCompareSliderHandle
              buttonStyle={{
                backdropFilter: "blur(8px)",
                background: "rgba(16, 185, 129, 0.9)",
                border: "2px solid #ffffff",
                boxShadow: "0 0 15px rgba(16, 185, 129, 0.5)",
                color: "#ffffff",
                width: "36px",
                height: "36px",
              }}
              linesStyle={{
                background: "rgba(255, 255, 255, 0.8)",
                boxShadow: "0 0 6px rgba(0, 0, 0, 0.6)",
                width: 2,
              }}
            />
          }
          itemOne={
            <ReactCompareSliderImage
              src={normalizedBefore}
              alt={beforeLabel}
              className="object-cover w-full h-full"
            />
          }
          itemTwo={
            <ReactCompareSliderImage
              src={normalizedAfter}
              alt={afterLabel}
              className="object-cover w-full h-full"
            />
          }
        />

        {/* Floating Before Badge (Top-Left) */}
        <div className="absolute top-3 left-3 pointer-events-none z-10 flex flex-col items-start gap-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-950/80 text-amber-400 border border-amber-500/30 backdrop-blur-md shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            {beforeLabel}
          </div>
          {formattedBeforeDate && (
            <span className="text-[10px] text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1 shadow">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formattedBeforeDate}
            </span>
          )}
        </div>

        {/* Floating After Badge (Top-Right) */}
        <div className="absolute top-3 right-3 pointer-events-none z-10 flex flex-col items-end gap-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-950/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {afterLabel}
          </div>
          {formattedAfterDate && (
            <span className="text-[10px] text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1 shadow">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formattedAfterDate}
            </span>
          )}
        </div>

        {/* Bottom Helper Hint */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none z-10 opacity-70 group-hover:opacity-100 transition">
          <span className="text-[10px] text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/10 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
            Drag handle left or right to compare
          </span>
        </div>
      </div>
    </div>
  );
}
