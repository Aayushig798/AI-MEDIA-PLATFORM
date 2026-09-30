"use client";

import { useState, useEffect } from "react";
import { TrustBadge } from "@/components/TrustBadge";
import {
  Search,
  Loader2,
  SlidersHorizontal,
  Check,
  BookmarkPlus,
  Columns2,
  Sparkles,
  Construction,
  Users,
  Recycle,
  Waves,
  Sun,
  Tent,
  SearchX,
  Images,
  Play,
  ArrowRight,
  FolderKanban,
  Tag,
  CalendarDays,
  EyeOff,
  Plus,
} from "lucide-react";
import { DOMAIN_CATEGORIES } from "@/lib/ai/categoryMapping";
import { SearchResultItem } from "@/lib/search/vectorSearch";
import { withTransformation } from "@/lib/cloudinary-url";
import { AssetDetailModal } from "@/components/AssetDetailModal";
import { CompareSlider } from "@/components/CompareSlider";
import { ComparisonWarningModal } from "@/components/ComparisonWarningModal";
import { PageHeader, EmptyState, ErrorNote, Modal, SectionHeader, IconChip, cx } from "@/components/ui";

const QUICK_PROMPTS = [
  { text: "earthquake rubble damage", icon: Construction },
  { text: "village community gathering", icon: Users },
  { text: "waste pollution cleanup", icon: Recycle },
  { text: "riverbank vegetation erosion", icon: Waves },
  { text: "solar panel installation", icon: Sun },
  { text: "field monitoring shelter", icon: Tent },
];

function cardImage(item: SearchResultItem) {
  return withTransformation(
    item.secureUrl,
    "c_fill,w_800,h_600,g_auto,q_auto,f_auto",
    item.resourceType === "video" ? "jpg" : undefined
  );
}

function shortDate(d: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [excludeFlagged, setExcludeFlagged] = useState(true);
  const [hiddenFlagged, setHiddenFlagged] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

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

  const activeFilterCount =
    (projectId !== "ALL" ? 1 : 0) + (category !== "ALL" ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0);

  // Read-only summary of the filters in use, shown as chips under the search box.
  const activeFilterChips = [
    projectId !== "ALL" && {
      key: "project",
      icon: FolderKanban,
      label: projects.find((p) => p.id === projectId)?.name ?? "One project",
    },
    category !== "ALL" && { key: "category", icon: Tag, label: category },
    fromDate && { key: "from", icon: CalendarDays, label: `After ${fromDate}` },
    toDate && { key: "to", icon: CalendarDays, label: `Before ${toDate}` },
  ].filter(Boolean) as { key: string; icon: typeof Tag; label: string }[];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Smart search"
        icon={Search}
        title="Search"
        description="Find photos across all your projects by describing what's in them."
        actions={
          <button
            type="button"
            onClick={() => {
              setCompareMode(!compareMode);
              setSelectedForCompare([]);
            }}
            className={cx("btn", compareMode ? "btn-dark" : "btn-secondary")}
          >
            <Columns2 className="h-4 w-4" />
            {compareMode ? "Cancel compare" : "Compare photos"}
          </button>
        }
      />

      {/* Search hero */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-16px_rgba(5,150,105,0.25)] ring-1 ring-emerald-100 sm:p-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(5,150,105,0.10)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/15">
              <Sparkles className="h-3.5 w-3.5" />
              AI search
            </span>
            <span className="text-[13px] text-zinc-500">
              Describe a scene in your own words. We match what&apos;s in each photo, plus its tags, place and notes.
            </span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" />
            <input
              type="text"
              id="natural-language-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'flooded road' or 'new saplings with tree guards'"
              className="input h-14 rounded-xl pl-12 pr-[7.5rem] text-base shadow-[0_1px_2px_rgba(16,24,40,0.05),0_8px_24px_-12px_rgba(16,24,40,0.15)] sm:pr-36"
            />
            <button
              type="submit"
              id="submit-vector-search-btn"
              disabled={loading || !query.trim()}
              className="btn btn-primary btn-lg absolute right-1.5 top-1/2 -translate-y-1/2 px-4 sm:px-5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[13px] font-medium text-zinc-500">Try</span>
            {QUICK_PROMPTS.map(({ text, icon: Icon }) => (
              <button
                key={text}
                type="button"
                onClick={() => {
                  setQuery(text);
                  handleSearch(text);
                }}
                className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-px hover:border-emerald-300 hover:text-emerald-800"
              >
                <Icon className="h-3.5 w-3.5 text-zinc-400 transition group-hover:text-emerald-600" />
                {text}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-emerald-100/80 pt-4">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={cx("btn btn-sm", showFilters ? "btn-dark" : "btn-secondary")}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span
                  className={cx(
                    "rounded-md px-1.5 text-xs tabular-nums",
                    showFilters ? "bg-white/15 text-white" : "bg-emerald-600 text-white"
                  )}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterChips.map(({ key, icon: Icon, label }) => (
              <span key={key} className="badge badge-green max-w-[14rem] py-1">
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            ))}
            {excludeFlagged && (
              <span className="badge badge-neutral py-1" title="Reused, copied or inconsistent photos are left out">
                <EyeOff className="h-3 w-3" />
                Flagged photos hidden
              </span>
            )}
          </div>

          {showFilters && (
            <div className="animate-fade-in space-y-4 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label" htmlFor="search-filter-project-select">
                    Project
                  </label>
                  <select
                    id="search-filter-project-select"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="input"
                  >
                    <option value="ALL">All projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="search-filter-ai-domain-select">
                    Category
                  </label>
                  <select
                    id="search-filter-ai-domain-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input"
                  >
                    <option value="ALL">All categories</option>
                    {DOMAIN_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="search-filter-from">
                    Taken after
                  </label>
                  <input
                    id="search-filter-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="search-filter-to">
                    Taken before
                  </label>
                  <input
                    id="search-filter-to"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={excludeFlagged}
                  onChange={(e) => setExcludeFlagged(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-emerald-600"
                />
                Hide flagged photos
                <span className="text-zinc-400">(reused, copied or inconsistent)</span>
              </label>
            </div>
          )}
        </div>
      </form>

      {/* Compare mode bar */}
      {compareMode && (
        <div className="card animate-fade-in sticky top-[4.5rem] z-30 flex flex-col gap-4 p-4 shadow-[0_16px_40px_-20px_rgba(16,24,40,0.35)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <IconChip icon={Columns2} tone="emerald" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">Pick two photos to compare</p>
              <p className="text-[13px] text-zinc-500">
                <span className="tabular-nums">{selectedForCompare.length}</span> of 2 selected. The earlier photo is shown as
                &ldquo;before&rdquo;.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {[0, 1].map((slot) => {
                const picked = selectedForCompare[slot];
                return picked ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={slot}
                    src={cardImage(picked)}
                    alt=""
                    className="h-11 w-14 rounded-lg object-cover ring-2 ring-emerald-500 ring-offset-1"
                  />
                ) : (
                  <span
                    key={slot}
                    className="flex h-11 w-14 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400"
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              disabled={selectedForCompare.length !== 2}
              onClick={() => setShowCompareModal(true)}
              className="btn btn-primary"
            >
              Compare
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <section className="space-y-4" aria-busy="true" aria-label="Searching">
          <div className="skeleton h-5 w-40 rounded-md" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton aspect-[4/3] w-full" />
                <div className="space-y-2.5 p-4">
                  <div className="flex gap-1.5">
                    <div className="skeleton h-5 w-16 rounded-md" />
                    <div className="skeleton h-5 w-20 rounded-md" />
                    <div className="skeleton h-5 w-12 rounded-md" />
                  </div>
                  <div className="skeleton h-4 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : searched && results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching photos"
          description={
            <>
              Try describing it differently, or loosen the filters.
              {hiddenFlagged > 0 && ` ${hiddenFlagged} flagged photo${hiddenFlagged === 1 ? " was" : "s were"} hidden.`}
            </>
          }
          action={
            <button type="button" onClick={() => setShowFilters(true)} className="btn btn-secondary">
              <SlidersHorizontal className="h-4 w-4" />
              Adjust filters
            </button>
          }
        />
      ) : results.length > 0 ? (
        <section className="space-y-4">
          <SectionHeader
            icon={Images}
            tone="emerald"
            title={
              <>
                <span className="tabular-nums">{results.length}</span> {results.length === 1 ? "result" : "results"}
              </>
            }
            description={
              <>
                Best matches first
                {hiddenFlagged > 0 && (
                  <>
                    {" · "}
                    <span className="tabular-nums">{hiddenFlagged}</span> flagged hidden
                  </>
                )}
              </>
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => {
              const matchPercent = Math.round(item.similarity * 100);
              const isSelected = selectedForCompare.some((i) => i.id === item.id);
              const categoryLabel = item.categories?.[0] || "Uncategorized";
              const taken = shortDate(item.capturedAt);

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
                  className={cx(
                    "card-interactive group flex cursor-pointer flex-col",
                    isSelected && "!border-emerald-500 ring-2 ring-emerald-500"
                  )}
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cardImage(item)}
                      alt={item.manualNotes || "Search result"}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

                    <div className="absolute left-3 top-3">
                      <TrustBadge integrity={item.integrity} />
                    </div>

                    {item.resourceType === "video" && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg">
                          <Play className="ml-0.5 h-4 w-4 fill-current" />
                        </span>
                      </div>
                    )}

                    {compareMode && (
                      <div className="absolute right-3 top-3">
                        <div
                          className={cx(
                            "flex h-7 w-7 items-center justify-center rounded-lg border-2 shadow-sm transition",
                            isSelected ? "border-emerald-500 bg-emerald-500 text-white" : "border-white bg-white/30 backdrop-blur"
                          )}
                        >
                          {isSelected ? <Check className="h-4 w-4" /> : null}
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-x-3 bottom-3 min-w-0 text-white">
                      <p className="truncate text-[15px] font-semibold drop-shadow-sm">{item.manualLocation || "No location"}</p>
                      <p className="truncate text-xs text-white/80">
                        {taken ?? "No date"}
                        {" · "}
                        {item.manualCategory || categoryLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {item.aiTags && item.aiTags.length > 0 && (
                      <div className="relative flex flex-wrap items-center gap-1.5">
                        {item.aiTags.slice(0, 3).map((t) => (
                          <span
                            key={t.id || t.label}
                            className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600"
                          >
                            {t.label}
                          </span>
                        ))}
                        {item.aiTags.length > 3 && (
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTagPopoverId(activeTagPopoverId === item.id ? null : item.id);
                              }}
                              onMouseEnter={() => setActiveTagPopoverId(item.id)}
                              className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"
                              title="Show all tags"
                            >
                              +{item.aiTags.length - 3}
                            </button>
                            {activeTagPopoverId === item.id && (
                              <div
                                onMouseLeave={() => setActiveTagPopoverId(null)}
                                onClick={(e) => e.stopPropagation()}
                                className="menu animate-fade-in absolute bottom-full left-0 mb-1.5 flex w-56 flex-wrap gap-1 p-2.5"
                              >
                                <p className="mb-1 flex w-full items-center gap-1.5 text-xs font-medium text-zinc-500">
                                  <Sparkles className="h-3 w-3 text-violet-500" />
                                  All tags (<span className="tabular-nums">{item.aiTags.length}</span>)
                                </p>
                                {item.aiTags.slice(3).map((t) => (
                                  <span
                                    key={t.id || t.label}
                                    className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600"
                                  >
                                    {t.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-violet-700 ring-1 ring-inset ring-violet-600/15"
                        title={`How closely this photo matches your description (distance ${item.distance})`}
                      >
                        <Sparkles className="h-3 w-3" />
                        {matchPercent}% match
                      </span>
                      <span
                        className={cx(
                          "inline-flex items-center gap-1 text-[13px] font-medium transition",
                          compareMode && isSelected ? "text-emerald-700" : "text-zinc-500 group-hover:text-zinc-900"
                        )}
                      >
                        {compareMode ? (isSelected ? "Selected" : "Select") : "View"}
                        {!compareMode && <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              tone: "violet" as const,
              title: "Describe it",
              text: "Write what you want to see, like you would to a colleague. No keywords or tags needed.",
            },
            {
              icon: SlidersHorizontal,
              tone: "sky" as const,
              title: "Narrow it down",
              text: "Filter by project, category or the dates the photos were taken.",
            },
            {
              icon: Columns2,
              tone: "emerald" as const,
              title: "Compare",
              text: "Pick any two results to see what changed, then save the pair as evidence.",
            },
          ].map(({ icon, tone, title, text }) => (
            <div key={title} className="card flex gap-3.5 p-5">
              <IconChip icon={icon} tone={tone} />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900">{title}</p>
                <p className="text-[13px] leading-relaxed text-zinc-500">{text}</p>
              </div>
            </div>
          ))}
        </section>
      )}

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
      <Modal
        open={showCompareModal && sortedComparePair.length === 2}
        onClose={() => setShowCompareModal(false)}
        size="xl"
        icon={Columns2}
        tone="emerald"
        title="Compare photos"
        description="Drag the slider to see what changed between the two photos."
        footer={
          <>
            {saveSuccess && (
              <span className="mr-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" /> Comparison saved
              </span>
            )}
            <button type="button" onClick={() => setShowCompareModal(false)} className="btn btn-ghost btn-sm">
              Close
            </button>
            <button
              type="button"
              id="save-search-comparison-btn"
              onClick={handleSaveComparisonFromSearch}
              disabled={savingComp || saveSuccess}
              className="btn btn-primary btn-sm"
            >
              {savingComp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
              {saveSuccess ? "Saved" : "Save comparison"}
            </button>
          </>
        }
      >
        {sortedComparePair.length === 2 && (
          <CompareSlider
            beforeUrl={sortedComparePair[0].secureUrl}
            afterUrl={sortedComparePair[1].secureUrl}
            beforeDate={sortedComparePair[0].capturedAt}
            afterDate={sortedComparePair[1].capturedAt}
            beforeLabel="Before"
            afterLabel="After"
            location={sortedComparePair[0].manualLocation || sortedComparePair[1].manualLocation}
          />
        )}
      </Modal>

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
