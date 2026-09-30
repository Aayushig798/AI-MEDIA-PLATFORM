"use client";

import { CalendarDays, X } from "lucide-react";
import { cx } from "./ui";

export const CATEGORY_OPTIONS = [
  "All",
  "Environmental",
  "Infrastructure",
  "Community",
  "Disaster Response",
  "Uncategorized",
] as const;

export type CategoryFilter = (typeof CATEGORY_OPTIONS)[number];

// Backward-compatibility export
export const CATEGORIES = CATEGORY_OPTIONS;

const DOTS: Record<string, string> = {
  Environmental: "bg-emerald-500",
  Infrastructure: "bg-sky-500",
  Community: "bg-amber-500",
  "Disaster Response": "bg-red-500",
  Uncategorized: "bg-zinc-400",
};

interface GalleryFilterBarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  fromDate: string;
  onSelectFromDate: (date: string) => void;
  toDate: string;
  onSelectToDate: (date: string) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

export function GalleryFilterBar({
  selectedCategory,
  onSelectCategory,
  fromDate,
  onSelectFromDate,
  toDate,
  onSelectToDate,
  onReset,
  totalCount,
  filteredCount,
}: GalleryFilterBarProps) {
  const hasActiveFilters =
    (selectedCategory && selectedCategory.toLowerCase() !== "all") ||
    fromDate ||
    toDate;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0">
        {CATEGORY_OPTIONS.map((cat) => {
          const isActive =
            selectedCategory.toLowerCase() === cat.toLowerCase() || (!selectedCategory && cat === "All");
          return (
            <button
              key={cat}
              id={`filter-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => onSelectCategory(cat)}
              aria-pressed={isActive}
              className={cx(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition",
                isActive
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:text-zinc-900 hover:ring-zinc-300",
              )}
            >
              {cat !== "All" && <span className={cx("h-1.5 w-1.5 rounded-full", DOTS[cat])} />}
              {cat === "All" ? "All media" : cat}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <CalendarDays className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            id="filter-date-from"
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => onSelectFromDate(e.target.value)}
            className="h-8 bg-transparent text-[13px] text-zinc-700 focus:outline-none"
          />
          <span className="text-[13px] text-zinc-400">to</span>
          <input
            id="filter-date-to"
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => onSelectToDate(e.target.value)}
            className="h-8 bg-transparent text-[13px] text-zinc-700 focus:outline-none"
          />
        </div>

        {hasActiveFilters && (
          <button id="reset-filters-btn" onClick={onReset} className="btn btn-ghost btn-sm">
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}

        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium tabular-nums text-zinc-600">
          {hasActiveFilters ? `${filteredCount} of ${totalCount}` : `${totalCount} ${totalCount === 1 ? "file" : "files"}`}
        </span>
      </div>
    </div>
  );
}
