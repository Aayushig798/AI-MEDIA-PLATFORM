"use client";

import { useState } from "react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
  ReactCompareSliderHandle,
} from "react-compare-slider";
import { getNormalizedComparisonUrl } from "@/lib/cloudinary-url";
import { MapPin } from "lucide-react";

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

/** Shows an all-caps label ("BEFORE") in sentence case; other labels are left as given. */
function displayLabel(label: string) {
  return label === label.toUpperCase() ? label.charAt(0) + label.slice(1).toLowerCase() : label;
}

const PRESETS = [25, 50, 75];

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

  const chip =
    "inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-semibold text-zinc-900 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur";

  return (
    <div className="flex flex-col gap-3">
      {(title || location || notes) && (
        <div className="min-w-0 space-y-0.5">
          {title && <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>}
          {location && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-500" />
              <span className="truncate">{location}</span>
            </p>
          )}
          {notes && <p className="pt-0.5 text-sm leading-relaxed text-zinc-600">{notes}</p>}
        </div>
      )}

      <div
        className={`relative w-full ${aspectRatio} select-none overflow-hidden rounded-xl bg-zinc-900 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.5)] ring-1 ring-black/10`}
      >
        <ReactCompareSlider
          key={sliderPosition}
          defaultPosition={sliderPosition}
          className="h-full w-full"
          handle={
            <ReactCompareSliderHandle
              buttonStyle={{
                backdropFilter: "none",
                background: "#ffffff",
                border: "none",
                boxShadow: "0 6px 20px -4px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(255, 255, 255, 0.28)",
                color: "#059669",
                width: "40px",
                height: "40px",
              }}
              linesStyle={{
                background: "#ffffff",
                boxShadow: "0 0 10px rgba(0, 0, 0, 0.35)",
                width: 2,
              }}
            />
          }
          itemOne={
            <ReactCompareSliderImage src={normalizedBefore} alt={beforeLabel} className="h-full w-full object-cover" />
          }
          itemTwo={
            <ReactCompareSliderImage src={normalizedAfter} alt={afterLabel} className="h-full w-full object-cover" />
          }
        />

        {/* Soft shade so the chips stay readable on bright skies */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-black/30 to-transparent" />

        <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 sm:left-3 sm:top-3">
          <span className={chip}>
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            {displayLabel(beforeLabel)}
            {formattedBeforeDate && <span className="font-medium tabular-nums text-zinc-500">{formattedBeforeDate}</span>}
          </span>
        </div>

        <div className="pointer-events-none absolute right-2.5 top-2.5 z-10 sm:right-3 sm:top-3">
          <span className={chip}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {displayLabel(afterLabel)}
            {formattedAfterDate && <span className="font-medium tabular-nums text-zinc-500">{formattedAfterDate}</span>}
          </span>
        </div>

        {/* Quick preset positions */}
        <div
          className="absolute bottom-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 rounded-lg bg-black/45 p-0.5 ring-1 ring-white/15 backdrop-blur-md sm:bottom-3"
          aria-label="Slider position"
        >
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSliderPosition(p)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium tabular-nums transition-colors ${
                sliderPosition === p ? "bg-white text-zinc-900 shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
