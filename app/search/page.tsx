"use client";

import { useState, useEffect } from "react";
import { TrustBadge } from "@/components/TrustBadge";
import {
  Sparkles,
  Search,
  Filter,
  Layers,
  MapPin,
  Calendar,
  Loader2,
  SlidersHorizontal,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  X,
  BookmarkPlus,
} from "lucide-react";
import { DOMAIN_CATEGORIES } from "@/lib/ai/categoryMapping";
import { SearchResultItem } from "@/lib/search/vectorSearch";
import { AssetDetailModal } from "@/components/AssetDetailModal";
import { CompareSlider } from "@/components/CompareSlider";
import { ComparisonWarningModal } from "@/components/ComparisonWarningModal";

const QUICK_PROMPTS = [
  "earthquake rubble damage",
  "village community gathering",
  "waste pollution cleanup",
  "riverbank vegetation erosion",
  "solar panel installation",
  "field monitoring shelter",
];

function getCategoryColor(category: string | null): string {
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

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [excludeFlagged, setExcludeFlagged] = useState(true);
  const [hiddenFlagged, setHiddenFlagged] = useState(0);

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  // Asset detail modal
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Quick Compare Selection Mode
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<SearchResultItem[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savingComp, setSavingComp] = useState(false);

  // Verification Warning Modal
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [pendingSavePayload, setPendingSavePayload] = useState<any>(null);
  const [activeTagPopoverId, setActiveTagPopoverId] = useState<string | null>(null);
  const [savingAnyway, setSavingAnyway] = useState(false);

  // Load projects list for filter dropdown
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch (e) {
        console.error("Failed to load projects:", e);
      }
    }
    loadProjects();
  }, []);

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery !== undefined ? overrideQuery : query;
    const hasFilter = Boolean(
      (projectId && projectId !== "ALL") ||
      (category && category !== "ALL") ||
      fromDate ||
      toDate
    );
    if (!q.trim() && !hasFilter) return;

    try {
      setLoading(true);
      setError("");
      setSearched(true);

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q.trim(),
          projectId: projectId !== "ALL" ? projectId : undefined,
          category: category !== "ALL" ? category : undefined,
          aiCategory: category !== "ALL" ? category : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          limit: 30,
          excludeFlagged,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results || []);
      setHiddenFlagged(data.hiddenFlagged ?? 0);
    } catch (err: any) {
      setError(err.message || "Failed to execute search");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectForCompare = (item: SearchResultItem) => {
    if (selectedForCompare.some((i) => i.id === item.id)) {
      setSelectedForCompare(selectedForCompare.filter((i) => i.id !== item.id));
    } else {
      if (selectedForCompare.length < 2) {
        setSelectedForCompare([...selectedForCompare, item]);
      } else {
        // Replace second item
        setSelectedForCompare([selectedForCompare[0], item]);
      }
    }
  };

  const handleSaveComparisonFromSearch = async () => {
    if (selectedForCompare.length !== 2) return;
    try {
      setSavingComp(true);
      const [first, second] = selectedForCompare;

      // Always order before/after by capturedAt automatically
      let before = first;
      let after = second;
      if (first.capturedAt && second.capturedAt) {
        if (new Date(first.capturedAt).getTime() > new Date(second.capturedAt).getTime()) {
          before = second;
          after = first;
        }
      } else if (!first.capturedAt && second.capturedAt) {
        before = second;
        after = first;
      } else {
        const t1 = new Date(first.createdAt).getTime();
        const t2 = new Date(second.createdAt).getTime();
        if (t1 > t2) {
          before = second;
          after = first;
        }
      }

      const payload = {
        projectId: before.projectId || second.projectId,
        beforeAssetId: before.id,
        afterAssetId: after.id,
        notes: "",
      };

      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.warning && data.needsConfirmation) {
        setWarningReason(data.reason || "These photos do not look like the same scene or have insufficient date separation.");
        setPendingSavePayload({
          ...payload,
          beforeAssetId: data.orderedBeforeId || before.id,
          afterAssetId: data.orderedAfterId || after.id,
          warningReason: data.reason,
        });
        setShowWarningModal(true);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save comparison");
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to save comparison");
    } finally {
      setSavingComp(false);
    }
  };

  const handleConfirmSaveAnyway = async () => {
    if (!pendingSavePayload) return;
    try {
      setSavingAnyway(true);
      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingSavePayload,
          saveAnyway: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save comparison");
      }

      setShowWarningModal(false);
      setPendingSavePayload(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to save comparison");
    } finally {
      setSavingAnyway(false);
    }
  };

  // Sort selected before/after by capturedAt automatically
  const sortedComparePair =
    selectedForCompare.length === 2
      ? (selectedForCompare[0].capturedAt && selectedForCompare[1].capturedAt
          ? new Date(selectedForCompare[0].capturedAt).getTime() <= new Date(selectedForCompare[1].capturedAt).getTime()
            ? [selectedForCompare[0], selectedForCompare[1]]
            : [selectedForCompare[1], selectedForCompare[0]]
          : new Date(selectedForCompare[0].createdAt).getTime() <= new Date(selectedForCompare[1].createdAt).getTime()
            ? [selectedForCompare[0], selectedForCompare[1]]
            : [selectedForCompare[1], selectedForCompare[0]])
      : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Semantic Discovery & Vector Search</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Intelligent Media Search
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Search unstructured visual evidence using natural language queries powered by semantic vector embeddings combined with structured filters.
          </p>
        </div>

        {/* Compare mode trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCompareMode(!compareMode);
              setSelectedForCompare([]);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
              compareMode
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{compareMode ? "Cancel Compare Mode" : "Pair & Compare Mode"}</span>
          </button>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="space-y-4"
        >
          <div className="relative">
            <Search className="w-5 h-5 text-emerald-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="natural-language-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "riverbank erosion damage" or "solar installation on mountain terrain"...'
              className="w-full pl-12 pr-28 py-4 rounded-2xl bg-slate-950/80 border border-white/10 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 shadow-inner"
            />
            <button
              type="submit"
              id="submit-vector-search-btn"
              disabled={loading || !query.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Search</span>
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-medium text-slate-500">Suggested queries:</span>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setQuery(prompt);
                  handleSearch(prompt);
                }}
                className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Structured Hybrid Filters Bar */}
          <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Project Filter */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Project Scope
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* AI Domain Category Filter */}
            <div>
              <label className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI Domain Category</span>
              </label>
              <select
                id="search-filter-ai-domain-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="ALL">All AI Domains</option>
                {DOMAIN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Captured After
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Captured Before
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeFlagged}
              onChange={(e) => setExcludeFlagged(e.target.checked)}
              className="accent-emerald-500"
            />
            Hide evidence the Integrity Engine flagged (recycled, lifted or inconsistent)
            {hiddenFlagged > 0 && <span className="text-rose-300">· {hiddenFlagged} hidden</span>}
          </label>
        </form>
      </div>

      {/* Compare Mode Banner */}
      {compareMode && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                Pair & Compare Selection Mode ({selectedForCompare.length}/2 selected)
              </p>
              <p className="text-[11px] text-slate-400">
                Click any 2 search results below to immediately launch an interactive before/after comparison slider.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={selectedForCompare.length !== 2}
            onClick={() => setShowCompareModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <span>Launch Slider</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Results Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm font-medium text-slate-300">
            Generating query embedding and calculating vector cosine similarity...
          </p>
          <span className="text-xs text-slate-500">Querying pgvector vector(1536) index</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
          {error}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-12 text-center">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Matching Visual Evidence Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            Try broadening your natural language description or clearing category and date filters.
          </p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">
              Ranked Search Results ({results.length})
            </h2>
            <span className="text-xs text-slate-400">
              Ordered by vector cosine similarity (<code className="text-emerald-300">&lt;=&gt;</code>)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((item) => {
              const matchPercent = Math.round(item.similarity * 100);
              const isSelected = selectedForCompare.some((i) => i.id === item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (compareMode) {
                      toggleSelectForCompare(item);
                    } else {
                      setSelectedAsset(item);
                    }
                  }}
                  className={`glass-card rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col justify-between group ${
                    isSelected
                      ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-950/20"
                      : "border-white/10 hover:border-emerald-500/30 hover:shadow-xl"
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
                    <img
                      src={item.secureUrl}
                      alt={item.manualNotes || "Search result"}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Similarity Badge */}
                    <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md flex items-center gap-1 shadow">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>{matchPercent}% match</span>
                    </div>

                    {/* Integrity Engine Trust Score */}
                    <div className="absolute bottom-2 left-2">
                      <TrustBadge integrity={item.integrity} />
                    </div>

                    {/* AI Domain Badge or Compare Selection Indicator */}
                    {compareMode ? (
                      <div className="absolute top-2 right-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
                            isSelected
                              ? "bg-emerald-500 text-slate-950 border-white font-bold"
                              : "bg-black/60 text-slate-400 border-white/20"
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="w-4 h-4" /> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="absolute top-2 right-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-md shadow ${getCategoryColor(
                            item.categories?.[0] || "Uncategorized"
                          )}`}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          AI: {item.categories?.[0] || "Uncategorized"}
                        </span>
                      </div>
                    )}

                    {/* Date / Location overlay */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between text-[10px] text-slate-300">
                      <span className="flex items-center gap-1 truncate max-w-[65%]">
                        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{item.manualLocation || "Field Site"}</span>
                      </span>
                      <span>
                        {item.capturedAt
                          ? new Date(item.capturedAt).toLocaleDateString()
                          : "Undated"}
                      </span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      {/* AI Assigned Domain vs Manual Tag */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getCategoryColor(
                            item.categories?.[0] || "Uncategorized"
                          )}`}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Assigned: {item.categories?.[0] || "Uncategorized"}
                        </span>

                        {item.manualCategory && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Manual: {item.manualCategory}
                          </span>
                        )}
                      </div>

                      {/* AI Tags Preview */}
                      {item.aiTags && item.aiTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5 relative">
                          {item.aiTags.slice(0, 3).map((t) => (
                            <span
                              key={t.id || t.label}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/5 font-mono"
                            >
                              #{t.label}
                            </span>
                          ))}
                          {item.aiTags.length > 3 && (
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTagPopoverId(
                                    activeTagPopoverId === item.id ? null : item.id
                                  );
                                }}
                                onMouseEnter={() => setActiveTagPopoverId(item.id)}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 font-mono transition"
                                title="Click to view all tags"
                              >
                                +{item.aiTags.length - 3}
                              </button>
                              {activeTagPopoverId === item.id && (
                                <div
                                  onMouseLeave={() => setActiveTagPopoverId(null)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute bottom-full left-0 mb-1 z-30 p-2.5 rounded-xl bg-slate-900/95 border border-white/15 shadow-2xl backdrop-blur-md flex flex-wrap gap-1 w-48 animate-fade-in"
                                >
                                  <div className="w-full text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                    All Tags ({item.aiTags.length})
                                  </div>
                                  {item.aiTags.slice(3).map((t) => (
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

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Distance: {item.distance}</span>
                      <span className="text-emerald-400 hover:underline">
                        {compareMode ? (isSelected ? "Selected" : "Select") : "Inspect &bull;"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onAssetUpdated={(updated) => {
            setResults(
              results.map((r) =>
                r.id === updated.id
                  ? {
                      ...r,
                      ...updated,
                      categories: Array.isArray(updated.categories)
                        ? updated.categories
                            .map((c: any) => (typeof c === "string" ? c : c.category?.name || c.name || ""))
                            .filter(Boolean)
                        : r.categories,
                    }
                  : r
              )
            );
            setSelectedAsset(null);
          }}
          onAssetDeleted={(deletedId) => {
            setResults(results.filter((r) => r.id !== deletedId));
            setSelectedAsset(null);
          }}
        />
      )}

      {/* Quick Compare Modal */}
      {showCompareModal && sortedComparePair.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div
            className="glass-dropdown w-full max-w-4xl max-h-[92vh] rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-white/10 overflow-y-auto flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                  Visual Evidence Comparison
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparing selected search results across timeline & visual change
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CompareSlider
              beforeUrl={sortedComparePair[0].secureUrl}
              afterUrl={sortedComparePair[1].secureUrl}
              beforeDate={sortedComparePair[0].capturedAt}
              afterDate={sortedComparePair[1].capturedAt}
              beforeLabel="BEFORE"
              afterLabel="AFTER"
              location={sortedComparePair[0].manualLocation || sortedComparePair[1].manualLocation}
            />

            <div className="flex items-center justify-between pt-2">
              <div>
                {saveSuccess && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Comparison pair saved successfully!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompareModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  id="save-search-comparison-btn"
                  onClick={handleSaveComparisonFromSearch}
                  disabled={savingComp || saveSuccess}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition shadow-lg shadow-emerald-500/20"
                >
                  {savingComp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookmarkPlus className="w-4 h-4" />
                  )}
                  <span>{saveSuccess ? "Saved Pair" : "Save Comparison"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Verification Warning Modal */}
      <ComparisonWarningModal
        isOpen={showWarningModal}
        reason={warningReason}
        onConfirmSaveAnyway={handleConfirmSaveAnyway}
        onCancel={() => {
          setShowWarningModal(false);
          setPendingSavePayload(null);
        }}
        saving={savingAnyway}
      />
    </div>
  );
}
