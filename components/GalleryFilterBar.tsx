"use client";

import { Filter, Calendar, RotateCcw } from "lucide-react";

export const CATEGORIES = [
  "ALL",
  "Environmental",
  "Infrastructure",
  "Community",
  "Disaster Response",
  "Other",
];

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
    (selectedCategory && selectedCategory !== "ALL") || fromDate || toDate;

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-white/5">
      {/* Category Filter Pills / Dropdown */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-1">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          Category:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const isActive =
              selectedCategory === cat || (!selectedCategory && cat === "ALL");
            return (
              <button
                key={cat}
                id={`filter-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                    : "bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/5"
                }`}
              >
                {cat === "ALL" ? "All Categories" : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Range & Reset Filters */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">From:</span>
          <input
            id="filter-date-from"
            type="date"
            value={fromDate}
            onChange={(e) => onSelectFromDate(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none text-xs"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">To:</span>
          <input
            id="filter-date-to"
            type="date"
            value={toDate}
            onChange={(e) => onSelectToDate(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none text-xs"
          />
        </div>

        {hasActiveFilters && (
          <button
            id="reset-filters-btn"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            <RotateCcw className="w-3 h-3 text-emerald-400" />
            <span>Reset</span>
          </button>
        )}

        <div className="text-xs text-slate-400 ml-auto md:ml-2">
          {filteredCount} / {totalCount} assets
        </div>
      </div>
    </div>
  );
}
