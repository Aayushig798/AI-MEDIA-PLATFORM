"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  FolderKanban,
  FolderOpen,
  Images,
  Inbox,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ConfirmDialog, EmptyState, ErrorNote, Modal, PageHeader, Stat, cx } from "@/components/ui";
import { effectiveVerdict, type IntegritySummary } from "@/components/TrustBadge";
import { withTransformation } from "@/lib/cloudinary-url";

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

interface AssetLite {
  id: string;
  projectId: string;
  secureUrl: string;
  resourceType: string;
  integrity?: IntegritySummary | null;
}

function coverUrl(a: AssetLite, w: number, h: number) {
  return withTransformation(
    a.secureUrl,
    `c_fill,w_${w},h_${h},g_auto,q_auto,f_auto`,
    a.resourceType === "video" ? "jpg" : undefined,
  );
}

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewModalOpenFromUrl = searchParams.get("new") === "true";

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
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

  // Covers and verification counts; the page still works if this fails.
  const fetchAssets = async () => {
    try {
      const res = await fetch("/api/assets");
      const data = await res.json();
      if (data.success && Array.isArray(data.assets)) setAssets(data.assets);
    } catch (err) {
      console.error("Failed to load media overview", err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchAssets();
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
  const totalLocations = new Set(projects.map((p) => p.location?.trim().toLowerCase()).filter(Boolean)).size;

  const overview = useMemo(() => {
    const byProject: Record<string, { covers: AssetLite[]; verified: number; review: number; total: number }> = {};
    let verified = 0;
    let review = 0;
    let videos = 0;
    for (const a of assets) {
      const entry = (byProject[a.projectId] ??= { covers: [], verified: 0, review: 0, total: 0 });
      entry.total++;
      if (entry.covers.length < 3) entry.covers.push(a);
      const v = effectiveVerdict(a.integrity);
      if (v === "VERIFIED") {
        entry.verified++;
        verified++;
      }
      if (v === "REVIEW") {
        entry.review++;
        review++;
      }
      if (a.resourceType === "video") videos++;
    }
    return { byProject, verified, review, videos };
  }, [assets]);

  const verifiedPct = assets.length ? Math.round((overview.verified / assets.length) * 100) : 0;

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setFormError("");
    if (isNewModalOpenFromUrl) router.replace("/projects");
  };

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Collect, verify and share photo evidence from every site you work on."
        actions={
          <button id="create-project-btn" onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            New project
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Projects"
          value={loading ? "–" : projects.length}
          icon={FolderKanban}
          tone="emerald"
          hint={`${totalLocations} ${totalLocations === 1 ? "location" : "locations"}`}
        />
        <Stat
          label="Photos & videos"
          value={loading ? "–" : totalAssets}
          icon={Images}
          tone="sky"
          hint={`${Math.max(0, totalAssets - overview.videos)} photos · ${overview.videos} videos`}
        />
        <Stat
          label="Verified"
          value={overview.verified}
          icon={ShieldCheck}
          tone="emerald"
          progress={verifiedPct}
          hint={`${verifiedPct}% of all media`}
        />
        <Stat
          label="Needs review"
          value={overview.review}
          icon={Inbox}
          tone="amber"
          href="/review"
          hint={overview.review ? "Waiting for a person to decide" : "All caught up"}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">All projects</h2>
            <p className="text-[13px] text-zinc-500">
              {searchQuery
                ? `${filteredProjects.length} of ${projects.length} match "${searchQuery}"`
                : "Newest first"}
            </p>
          </div>
          {projects.length > 0 && (
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="search-projects-input"
                type="text"
                placeholder="Search by name, place or description"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton aspect-[16/9]" />
                <div className="space-y-2.5 p-5">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-3 w-full rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={searchQuery ? "No matching projects" : "Start your first project"}
            description={
              searchQuery
                ? "Try a different name, place or keyword."
                : "A project groups the photos and videos from one site. Upload media and EcoEvidence dates, tags and verifies every file."
            }
            action={
              !searchQuery && (
                <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                  <Plus className="h-4 w-4" />
                  New project
                </button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => {
              const count = project._count?.assets ?? 0;
              const info = overview.byProject[project.id];
              const covers = info?.covers ?? [];
              const verified = info?.verified ?? 0;
              const pct = count ? Math.round((verified / count) * 100) : 0;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  id={`project-card-${project.id}`}
                  className="card-interactive group relative flex flex-col overflow-hidden"
                >
                  {/* Cover */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-zinc-100">
                    {covers.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 via-white to-sky-50 text-zinc-400">
                        <div className="absolute inset-0 bg-[radial-gradient(rgba(16,185,129,0.14)_1px,transparent_1px)] [background-size:16px_16px]" />
                        <Images className="relative h-7 w-7 text-emerald-500/70" />
                        <span className="relative text-xs font-medium">No photos yet</span>
                      </div>
                    ) : covers.length < 3 ? (
                      <img
                        src={coverUrl(covers[0], 720, 405)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="grid h-full grid-cols-3 grid-rows-2 gap-0.5">
                        <img
                          src={coverUrl(covers[0], 480, 405)}
                          alt=""
                          loading="lazy"
                          className="col-span-2 row-span-2 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <img src={coverUrl(covers[1], 240, 200)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        <img src={coverUrl(covers[2], 240, 200)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </div>
                    )}

                    {project.location && (
                      <span className="photo-chip absolute left-3 top-3 max-w-[70%]">
                        <MapPin className="h-3 w-3 shrink-0 text-sky-600" />
                        <span className="truncate">{project.location}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      id={`delete-project-card-btn-${project.id}`}
                      title="Delete project"
                      aria-label={`Delete ${project.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteError("");
                        setProjectToDelete(project);
                      }}
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-zinc-500 opacity-0 shadow-sm ring-1 ring-black/5 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-1 text-[15px] font-semibold tracking-tight text-zinc-900 transition group-hover:text-emerald-700">
                      {project.name}
                    </h3>
                    <p
                      className={cx(
                        "mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed",
                        project.description ? "text-zinc-500" : "text-zinc-400",
                      )}
                    >
                      {project.description || "No description yet."}
                    </p>

                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-700">
                          {verified} of {count} verified
                        </span>
                        <span className="tabular-nums text-zinc-400">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3.5 text-[13px] text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <Images className="h-3.5 w-3.5 text-zinc-400" />
                        {count} {count === 1 ? "file" : "files"}
                        {info?.review ? <span className="badge badge-amber ml-1">{info.review} to review</span> : null}
                      </span>
                      {project.startDate && (
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
                          {new Date(project.startDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}

            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="group flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-500 transition hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 transition group-hover:ring-emerald-200">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">New project</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* New project */}
      <Modal
        open={isModalOpen}
        onClose={closeCreateModal}
        icon={FolderKanban}
        title="New project"
        description="A project groups the photos and videos from one site or initiative."
      >
        <form id="new-project-form" onSubmit={handleCreateProject} className="space-y-4">
          <ErrorNote>{formError}</ErrorNote>

          <div>
            <label className="label" htmlFor="project-name-input">
              Name
            </label>
            <input
              id="project-name-input"
              type="text"
              required
              autoFocus
              placeholder="e.g. Aravalli check dams"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="project-location-input">
                Location <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="project-location-input"
                type="text"
                placeholder="e.g. Udaipur, Rajasthan"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="project-date-input">
                Start date
              </label>
              <input
                id="project-date-input"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="project-desc-input">
              Description <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="project-desc-input"
              rows={3}
              placeholder="What is this project doing, and what should the photos show?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" id="cancel-project-modal-btn" onClick={closeCreateModal} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" id="project-submit-btn" disabled={submitting} className="btn btn-primary">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating" : "Create project"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        busy={!!deletingId}
        error={deleteError}
        title={`Delete "${projectToDelete?.name ?? ""}"?`}
        description="This permanently deletes the project and all of its photos and videos. This can't be undone."
        confirmLabel="Delete project"
      />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageContent />
    </Suspense>
  );
}
