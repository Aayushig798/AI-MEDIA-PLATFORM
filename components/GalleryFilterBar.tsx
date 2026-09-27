"use client";

import { Filter, Calendar, RotateCcw, Sparkles, Tag } from "lucide-react";
import { DOMAIN_CATEGORIES } from "@/lib/ai/categoryMapping";

export const CATEGORIES = [
  "ALL",
  "Environmental",
  "Infrastructure",
  "Community",
  "Disaster Response",
  "Other",
];

export const AI_CATEGORIES = ["ALL", ...DOMAIN_CATEGORIES];

interface GalleryFilterBarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedAiCategory: string;
  onSelectAiCategory: (cat: string) => void;
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
  selectedAiCategory,
  onSelectAiCategory,
  fromDate,
  onSelectFromDate,
  toDate,
  onSelectToDate,
  onReset,
  totalCount,
  filteredCount,
}: GalleryFilterBarProps) {
  const hasActiveFilters =
    (selectedCategory && selectedCategory !== "ALL") ||
    (selectedAiCategory && selectedAiCategory !== "ALL") ||
    fromDate ||
    toDate;

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3.5 border border-white/5">
      {/* Row 1: AI-Assisted Category Filter (Primary in Phase 2) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            AI Domain Category:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {AI_CATEGORIES.map((cat) => {
              const isActive =
                selectedAiCategory === cat || (!selectedAiCategory && cat === "ALL");
              return (
                <button
                  key={cat}
                  id={`filter-ai-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => onSelectAiCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                      : "bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/5"
                  }`}
                >
                  {cat === "ALL" ? "All AI Categories" : cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="font-bold text-emerald-400">{filteredCount}</span> of {totalCount} assets
        </div>
      </div>

      {/* Row 2: Manual Tags & Date Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1 mr-1">
            <Tag className="w-3 h-3 text-slate-400" />
            Manual Category:
          </span>
          <select
            id="filter-manual-category-select"
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "ALL" ? "All Manual Categories" : cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </div>
    </div>
  );
}
