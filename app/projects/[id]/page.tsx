"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  UploadCloud, 
  Layers, 
  Loader2, 
  ShieldCheck, 
  FileSpreadsheet, 
  Info,
  ExternalLink,
  Trash2,
  AlertTriangle,
  X,
  SlidersHorizontal,
  Image as ImageIcon
} from "lucide-react";
import { GalleryFilterBar } from "@/components/GalleryFilterBar";
import { GalleryGrid, MediaAssetItem } from "@/components/GalleryGrid";
import { UploadModal } from "@/components/UploadModal";
import { AssetDetailModal } from "@/components/AssetDetailModal";
import { SuggestedComparisons } from "@/components/SuggestedComparisons";
import { SavedComparisons } from "@/components/SavedComparisons";

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

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetItem | null>(null);

  // Tabs (Phase 3: Media Gallery vs Before/After Comparisons)
  const [activeTab, setActiveTab] = useState<"gallery" | "comparisons">("gallery");
  const [comparisonsRefreshKey, setComparisonsRefreshKey] = useState(0);

  // Project Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

      const res = await fetch(`/api/assets?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.assets)) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error("Failed to load assets", err);
    } finally {
      setLoadingAssets(false);
    }
  }, [projectId, selectedCategory, fromDate, toDate]);

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
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm">Loading project repository...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center max-w-md mx-auto my-12">
        <h3 className="text-lg font-bold text-white">Project Not Found</h3>
        <p className="text-xs text-slate-400 mt-2 mb-6">
          The requested impact initiative does not exist or may have been archived.
        </p>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Projects</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 hover:text-white transition group"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
          <span>Back to All Projects</span>
        </Link>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-mono text-slate-500">ID: {project.id}</span>
        </div>
      </div>

      {/* Project Banner / Header Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/5 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Project
              </span>

              {project.startDate && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Initiated: {new Date(project.startDate).toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}

              {project.location && (
                <span className="inline-flex items-center gap-1 text-xs text-teal-400 font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  {project.location}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {project.name}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              {project.description || "No detailed scope has been added for this project yet."}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap lg:flex-col items-stretch gap-3 shrink-0">
            <button
              id="open-upload-modal-btn"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Media</span>
            </button>

            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-400 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>{assets.length} Assets</span>
              </div>

              {/* Delete Project Button */}
              <button
                type="button"
                id="open-delete-project-modal-btn"
                onClick={() => setShowDeleteModal(true)}
                title="Delete this project and all its media"
                className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher (Phase 3: Media Evidence vs Before/After Comparisons) */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          id="project-tab-gallery"
          onClick={() => setActiveTab("gallery")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === "gallery"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md shadow-emerald-500/10"
              : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Media Evidence Stream ({assets.length})</span>
        </button>

        <button
          type="button"
          id="project-tab-comparisons"
          onClick={() => setActiveTab("comparisons")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === "comparisons"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md shadow-emerald-500/10"
              : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          <span>Before / After Change Comparisons</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Phase 3
          </span>
        </button>
      </div>

      {activeTab === "gallery" ? (
        <>
          {/* Filter Bar */}
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

          {/* Media Gallery Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                Field Media Stream &bull; Newest First
              </span>
              <span className="text-[11px] text-slate-400">
                Thumbnails rendered via Cloudinary dynamic transformations
              </span>
            </div>

            {loadingAssets ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                <p className="text-xs">Fetching evidence assets...</p>
              </div>
            ) : (
              <GalleryGrid
                assets={assets}
                onSelectAsset={(asset) => setSelectedAsset(asset)}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}
          </div>
        </>
      ) : (
        <div className="space-y-10 animate-fade-in">
          {/* Suggested Comparisons Section */}
          <SuggestedComparisons
            projectId={projectId}
            onComparisonSaved={() => setComparisonsRefreshKey((k) => k + 1)}
          />

          {/* Saved Comparisons Section */}
          <SavedComparisons
            projectId={projectId}
            refreshTrigger={comparisonsRefreshKey}
          />
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        projectId={projectId}
        defaultLocation={project.location || ""}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* Asset Detail & Edit Modal */}
      <AssetDetailModal
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onAssetUpdated={handleAssetUpdated}
        onAssetDeleted={handleAssetDeleted}
      />

      {/* Delete Project Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div 
            className="glass-dropdown w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-red-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-white">Delete Project?</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">&ldquo;{project.name}&rdquo;</strong>?
            </p>
            <p className="text-xs text-red-400 mt-2 bg-red-950/40 p-3 rounded-xl border border-red-500/20">
              Warning: This will permanently erase the project record and destroy all <strong className="text-white">{assets.length}</strong> associated evidence media assets from Cloudinary CDN and the database.
            </p>

            {deleteError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-500/20 text-red-200 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingProject}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-project-btn"
                onClick={handleDeleteProject}
                disabled={deletingProject}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 disabled:opacity-50 transition"
              >
                {deletingProject ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{deletingProject ? "Deleting Project..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
