"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Columns2,
  Copy,
  FileText,
  Images,
  MapPin,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { GalleryFilterBar } from "@/components/GalleryFilterBar";
import { GalleryGrid, MediaAssetItem } from "@/components/GalleryGrid";
import { UploadModal } from "@/components/UploadModal";
import { AssetDetailModal } from "@/components/AssetDetailModal";
import { SuggestedComparisons } from "@/components/SuggestedComparisons";
import { SavedComparisons } from "@/components/SavedComparisons";
import { ProjectIntegrityBar, ProjectIntegrityFields } from "@/components/ProjectIntegrityBar";
import { effectiveVerdict } from "@/components/TrustBadge";
import { ConfirmDialog, EmptyState, Loading, Menu, Tabs } from "@/components/ui";
import { withTransformation } from "@/lib/cloudinary-url";

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  createdAt: string;
  _count?: {
    assets: number;
  };
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  impactType: ProjectIntegrityFields["impactType"];
  claim: string | null;
}

export default function ProjectGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("ALL");
  // Unfiltered list for the integrity counts and "verify all"
  const [allAssets, setAllAssets] = useState<MediaAssetItem[]>([]);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetItem | null>(null);

  // Active View: Gallery vs Before/After Comparisons
  const [activeTab, setActiveTab] = useState<"gallery" | "comparisons">("gallery");
  const [comparisonsRefreshKey, setComparisonsRefreshKey] = useState(0);

  // Project Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [copiedProjectId, setCopiedProjectId] = useState(false);

  const fetchProjectInfo = useCallback(async () => {
    try {
      setLoadingProject(true);
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success && data.project) {
        setProject(data.project);
      }
    } catch (err) {
      console.error("Failed to load project info", err);
    } finally {
      setLoadingProject(false);
    }
  }, [projectId]);

  const fetchAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      const queryParams = new URLSearchParams();
      queryParams.append("projectId", projectId);

      if (selectedCategory && selectedCategory.toLowerCase() !== "all") {
        queryParams.append("category", selectedCategory);
      }
      if (fromDate) {
        queryParams.append("from", fromDate);
      }
      if (toDate) {
        queryParams.append("to", toDate);
      }
      if (verdictFilter !== "ALL") {
        queryParams.append("verdict", verdictFilter);
      }

      const [res, allRes] = await Promise.all([
        fetch(`/api/assets?${queryParams.toString()}`),
        fetch(`/api/assets?projectId=${projectId}`),
      ]);
      const data = await res.json();
      const allData = await allRes.json();
      if (data.success && Array.isArray(data.assets)) {
        setAssets(data.assets);
      }
      if (allData.success && Array.isArray(allData.assets)) {
        setAllAssets(allData.assets);
      }
    } catch (err) {
      console.error("Failed to load assets", err);
    } finally {
      setLoadingAssets(false);
    }
  }, [projectId, selectedCategory, fromDate, toDate, verdictFilter]);

  useEffect(() => {
    fetchProjectInfo();
  }, [fetchProjectInfo]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleResetFilters = () => {
    setSelectedCategory("All");
    setFromDate("");
    setToDate("");
    setVerdictFilter("ALL");
  };

  const handleUploadComplete = () => {
    fetchAssets();
    fetchProjectInfo();
  };

  const handleAssetUpdated = (updatedAsset: MediaAssetItem) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
    );
    setSelectedAsset(updatedAsset);
    setComparisonsRefreshKey((k) => k + 1);
  };

  const handleAssetDeleted = (deletedId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== deletedId));
    setSelectedAsset(null);
    fetchProjectInfo();
  };

  const handleDeleteProject = async () => {
    try {
      setDeletingProject(true);
      setDeleteError("");

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete project");
      }

      router.push("/projects");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete project");
      setDeletingProject(false);
    }
  };

  if (loadingProject && !project) {
    return <Loading label="Loading project" />;
  }

  if (!project) {
    return (
      <EmptyState
        icon={Images}
        title="Project not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Link href="/projects" className="btn btn-secondary">
            Back to projects
          </Link>
        }
      />
    );
  }

  const totalFiles = project._count?.assets ?? allAssets.length;
  const verifiedCount = allAssets.filter((a) => effectiveVerdict(a.integrity) === "VERIFIED").length;
  const cover = allAssets.find((a) => a.resourceType !== "video") ?? allAssets[0];
  const coverSrc = cover
    ? withTransformation(
        cover.secureUrl,
        "c_fill,w_1600,h_560,g_auto,q_auto,f_auto",
        cover.resourceType === "video" ? "jpg" : undefined,
      )
    : null;

  const capturedDates = allAssets
    .map((a) => (a.capturedAt ? new Date(a.capturedAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  const fmtMonth = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const span = capturedDates.length
    ? (() => {
        const a = fmtMonth(Math.min(...capturedDates));
        const b = fmtMonth(Math.max(...capturedDates));
        return a === b ? a : `${a} – ${b}`;
      })()
    : null;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Hero banner */}
      <section className="relative isolate rounded-3xl bg-zinc-900 shadow-[0_24px_48px_-24px_rgba(16,24,40,0.45)]">
        {/* Clipping lives on the background only, so the options menu can overflow the banner. */}
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          {coverSrc ? (
            <img src={coverSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-emerald-600 via-teal-700 to-zinc-900">
              <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:18px_18px]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/55 to-zinc-950/20" />
        </div>

        <div className="flex min-h-[280px] flex-col justify-between gap-8 p-5 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm text-white/90 ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Link>
            <div className="flex items-center gap-2">
              <Link href={`/projects/${project.id}/report`} className="btn btn-glass btn-sm hidden sm:inline-flex">
                <FileText className="h-4 w-4" />
                Report
              </Link>
              <button
                id="open-upload-modal-btn"
                onClick={() => setIsUploadOpen(true)}
                className="btn btn-sm bg-white text-zinc-900 shadow-sm hover:bg-zinc-100"
              >
                <Upload className="h-4 w-4" />
                Upload
              </button>
              <Menu label="Project options" buttonClassName="btn btn-glass btn-sm btn-icon">
                <Link href={`/projects/${project.id}/report`} className="menu-item sm:hidden">
                  <FileText className="h-4 w-4 text-zinc-400" />
                  Report
                </Link>
                <Link href={`/projects/${project.id}/dashboard`} className="menu-item">
                  <BarChart3 className="h-4 w-4 text-zinc-400" />
                  Insights
                </Link>
                <Link href={`/search?projectId=${project.id}`} className="menu-item">
                  <Search className="h-4 w-4 text-zinc-400" />
                  Search this project
                </Link>
                <button
                  type="button"
                  id="project-options-menu-btn"
                  className="menu-item"
                  onClick={() => {
                    navigator.clipboard.writeText(project.id);
                    setCopiedProjectId(true);
                    setTimeout(() => setCopiedProjectId(false), 2000);
                  }}
                >
                  <Copy className="h-4 w-4 text-zinc-400" />
                  {copiedProjectId ? "Copied" : "Copy project ID"}
                </button>
                <div className="my-1 border-t border-zinc-100" />
                <button
                  type="button"
                  id="open-delete-project-modal-btn"
                  onClick={() => {
                    setDeleteError("");
                    setShowDeleteModal(true);
                  }}
                  className="menu-item text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete project
                </button>
              </Menu>
            </div>
          </div>

          <div className="space-y-4">
            <div className="max-w-3xl space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{project.name}</h1>
              {project.description && (
                <p className="text-[15px] leading-relaxed text-white/75">{project.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-[13px] text-white">
              {project.location && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 ring-1 ring-white/15 backdrop-blur-md">
                  <MapPin className="h-3.5 w-3.5 text-sky-300" />
                  {project.location}
                </span>
              )}
              {project.startDate && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 ring-1 ring-white/15 backdrop-blur-md">
                  <CalendarDays className="h-3.5 w-3.5 text-sky-300" />
                  Started{" "}
                  {new Date(project.startDate).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 ring-1 ring-white/15 backdrop-blur-md">
                <Images className="h-3.5 w-3.5 text-sky-300" />
                {totalFiles} {totalFiles === 1 ? "file" : "files"}
                {span ? ` · ${span}` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 ring-1 ring-emerald-300/30 backdrop-blur-md">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                {verifiedCount} verified
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: "gallery", label: "Media", count: totalFiles, icon: Images },
            { value: "comparisons", label: "Before & after", icon: Columns2 },
          ]}
        />
        <div className="flex items-center gap-1">
          <Link href={`/projects/${project.id}/dashboard`} className="btn btn-ghost btn-sm">
            <BarChart3 className="h-4 w-4" />
            Insights
          </Link>
          <Link href={`/search?projectId=${project.id}`} className="btn btn-ghost btn-sm">
            <Search className="h-4 w-4" />
            Search
          </Link>
        </div>
      </div>

      {activeTab === "gallery" ? (
        <div className="space-y-6">
          <ProjectIntegrityBar
            project={project}
            assets={allAssets}
            verdictFilter={verdictFilter}
            onVerdictFilter={setVerdictFilter}
            onAssetsVerified={fetchAssets}
            onProjectUpdated={(p) => setProject((prev) => (prev ? { ...prev, ...p } : prev))}
          />

          <div className="space-y-4">
            <GalleryFilterBar
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              fromDate={fromDate}
              onSelectFromDate={setFromDate}
              toDate={toDate}
              onSelectToDate={setToDate}
              onReset={handleResetFilters}
              totalCount={project._count?.assets ?? assets.length}
              filteredCount={assets.length}
            />

            {loadingAssets ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="card overflow-hidden">
                    <div className="skeleton aspect-[4/3]" />
                    <div className="space-y-2 p-3.5">
                      <div className="skeleton h-3.5 w-2/3 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <GalleryGrid
                assets={assets}
                onSelectAsset={(asset) => setSelectedAsset(asset)}
                onOpenUpload={() => setIsUploadOpen(true)}
                onAssetUpdated={handleAssetUpdated}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="animate-fade-in space-y-10">
          <SuggestedComparisons
            projectId={projectId}
            refreshTrigger={comparisonsRefreshKey}
            onComparisonSaved={() => setComparisonsRefreshKey((k) => k + 1)}
          />
          <SavedComparisons projectId={projectId} refreshTrigger={comparisonsRefreshKey} />
        </div>
      )}

      <UploadModal
        projectId={projectId}
        defaultLocation={project.location || ""}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      <AssetDetailModal
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onAssetUpdated={handleAssetUpdated}
        onAssetDeleted={handleAssetDeleted}
      />

      <ConfirmDialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteProject}
        busy={deletingProject}
        error={deleteError}
        title={`Delete "${project.name}"?`}
        description={`This permanently deletes the project and its ${totalFiles} ${totalFiles === 1 ? "file" : "files"}. This can't be undone.`}
        confirmLabel="Delete project"
      />
    </div>
  );
}
