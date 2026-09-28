"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImageIcon,
  Layers,
  Search,
  BarChart3,
  Loader2,
} from "lucide-react";
import { ReportBuilder } from "@/components/ReportBuilder";

export default function ProjectReportPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<{ id: string; name: string; location?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/impact-stats`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.facts) {
          setProject({
            id: data.facts.projectId,
            name: data.facts.projectName,
            location: data.facts.projectLocation,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading Report Studio...</p>
      </div>
    );
  }

  const projectName = project?.name || "Impact Evidence Project";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header & Navigation */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/projects/${projectId}`}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
              title="Return to Gallery"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Reporting & Traceability
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-400">{projectName}</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
                Impact Report Studio
              </h1>
            </div>
          </div>

          {/* Quick Action Navigation Tabs */}
          <div className="flex items-center flex-wrap gap-2">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Evidence Gallery</span>
            </Link>

            <Link
              href={`/projects/${projectId}?tab=comparisons`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Comparisons</span>
            </Link>

            <Link
              href={`/search?projectId=${projectId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Semantic Search</span>
            </Link>

            <Link
              href={`/projects/${projectId}/dashboard`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Impact Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <ReportBuilder projectId={projectId} projectName={projectName} />
      </main>
    </div>
  );
}
