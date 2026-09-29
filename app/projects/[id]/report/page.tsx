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
  FileText,
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
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 hover:text-white transition group"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
          <span>Back to {projectName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/dashboard`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition"
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Impact Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
            <FileText className="w-3.5 h-3.5" />
            Impact Reporting Studio
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Stakeholder Impact Report
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Generate, customize, and export audit-ready sustainability impact evidence reports for {projectName}.
          </p>
        </div>
      </div>

      {/* Main Report Builder */}
      <ReportBuilder projectId={projectId} projectName={projectName} />
    </div>
  );
}
