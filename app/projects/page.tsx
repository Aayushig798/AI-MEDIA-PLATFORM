"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  FolderPlus, 
  MapPin, 
  Calendar, 
  Layers, 
  ArrowRight, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  X,
  Loader2,
  FolderOpen,
  Trash2,
  AlertTriangle
} from "lucide-react";

interface ProjectItem {
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

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewModalOpenFromUrl = searchParams.get("new") === "true";

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(isNewModalOpenFromUrl);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    startDate: new Date().toISOString().split("T")[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Deletion State
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (isNewModalOpenFromUrl) {
      setIsModalOpen(true);
    }
  }, [isNewModalOpenFromUrl]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Project name is required.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create project");
      }

      setIsModalOpen(false);
      setFormData({
        name: "",
        description: "",
        location: "",
        startDate: new Date().toISOString().split("T")[0],
      });
      await fetchProjects();
      router.push(`/projects/${data.project.id}`);
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      setDeletingId(projectToDelete.id);
      setDeleteError("");

      const res = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete project");
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const totalAssets = projects.reduce((acc, p) => acc + (p._count?.assets || 0), 0);
  const totalLocations = new Set(projects.map((p) => p.location).filter(Boolean)).size;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Field Evidence Repository
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Impact & Sustainability Projects
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Centralized hub for field initiatives, environmental restoration, community infrastructure, and visual evidence timelines.
          </p>
        </div>

        <button
          id="create-project-btn"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Projects</p>
          <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
          <span className="text-[11px] text-emerald-400">All field initiatives</span>
        </div>
        <div className="glass-panel p-4 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Visual Assets</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{totalAssets}</p>
          <span className="text-[11px] text-slate-400">Cloudinary CDN secured</span>
        </div>
        <div className="glass-panel p-4 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Field Locations</p>
          <p className="text-2xl font-bold text-teal-300 mt-1">{totalLocations}</p>
          <span className="text-[11px] text-slate-400">Geographic points</span>
        </div>
        <div className="glass-panel p-4 rounded-2xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">AI Intelligence</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">Active</p>
          <span className="text-[11px] text-slate-400">Phase 2 Auto-Tagging</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search-projects-input"
            type="text"
            placeholder="Search by project name, location, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition"
          />
        </div>
        <div className="text-xs text-slate-400 self-end sm:self-center">
          Showing <span className="font-semibold text-slate-200">{filteredProjects.length}</span> of {projects.length} projects
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm">Loading field projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-slate-400 mb-4">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">No projects found</h3>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            {searchQuery
              ? "No projects match your search criteria. Try a different query."
              : "Get started by creating your first environmental or sustainability field project."}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition"
          >
            <FolderPlus className="w-4 h-4" />
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              id={`project-card-${project.id}`}
              className="glass-card rounded-2xl p-6 flex flex-col justify-between group border border-white/5 hover:border-emerald-500/30 transition-all duration-300 relative"
            >
              <div>
                {/* Header tags & delete icon */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <Layers className="w-3 h-3" />
                    {project._count?.assets ?? 0} Evidence Assets
                  </span>

                  <div className="flex items-center gap-2">
                    {project.startDate && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(project.startDate).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}

                    {/* Delete button on card */}
                    <button
                      type="button"
                      id={`delete-project-card-btn-${project.id}`}
                      title="Delete project"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                      className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Project Title */}
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                  {project.name}
                </h3>

                {/* Location */}
                {project.location && (
                  <div className="flex items-center gap-1.5 text-xs text-teal-400/90 mt-2 font-medium">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                    <span className="truncate">{project.location}</span>
                  </div>
                )}

                {/* Description */}
                <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                  {project.description || "No project description provided."}
                </p>
              </div>

              {/* Card Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
                <span>Open Evidence Gallery</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div 
            className="glass-dropdown w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl relative border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              id="close-project-modal-btn"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                <FolderPlus className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">Create New Project</h2>
              <p className="text-xs text-slate-400 mt-1">
                Establish an environmental, infrastructure, or community initiative to collect and verify field media.
              </p>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {formError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Project Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="project-name-input"
                  type="text"
                  required
                  placeholder="e.g. Madre de Dios Rainforest Canopy Monitoring"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Location Text
                </label>
                <input
                  id="project-location-input"
                  type="text"
                  placeholder="e.g. Madre de Dios, Peru (GPS / Region)"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Start Date
                </label>
                <input
                  id="project-date-input"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Project Description & Goals
                </label>
                <textarea
                  id="project-desc-input"
                  rows={3}
                  placeholder="Describe the mission, monitoring scope, baseline conditions, and expected outcomes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                <button
                  type="button"
                  id="cancel-project-modal-btn"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="project-submit-btn"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? "Creating..." : "Create Project"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div 
            className="glass-dropdown w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-red-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setProjectToDelete(null)}
              className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-white">Delete Project?</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">&ldquo;{projectToDelete.name}&rdquo;</strong>?
            </p>
            <p className="text-xs text-red-400 mt-2 bg-red-950/40 p-3 rounded-xl border border-red-500/20">
              Warning: This will permanently erase the project record and destroy all associated visual evidence assets from Cloudinary CDN and the database.
            </p>

            {deleteError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-500/20 text-red-200 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-project-from-list-btn"
                onClick={handleConfirmDelete}
                disabled={!!deletingId}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 disabled:opacity-50 transition"
              >
                {deletingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{deletingId ? "Deleting Project..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm">Loading field initiatives...</p>
        </div>
      }
    >
      <ProjectsPageContent />
    </Suspense>
  );
}
