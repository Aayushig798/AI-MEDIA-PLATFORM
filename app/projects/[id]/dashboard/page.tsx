"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Layers,
  Search,
  FileText,
  ArrowLeft,
  Calendar,
  MapPin,
  ShieldCheck,
  Image as ImageIcon,
  Video,
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { ImpactCharts } from "@/components/ImpactCharts";

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/impact-stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data.facts);
      } else {
        setError(data.error || "Failed to load project impact statistics");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to impact service");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [projectId]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-400">Assembling structured project analytics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col items-center justify-center">
        <div className="max-w-md w-full glass-panel rounded-2xl p-6 text-center space-y-4 border border-red-500/20">
          <p className="text-sm text-red-300">{error || "Project data unavailable"}</p>
          <div className="flex justify-center gap-3">
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold hover:bg-slate-700"
            >
              Back to Project
            </Link>
            <button
              onClick={fetchStats}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dateSpanFormatted = stats.dateRange
    ? `${new Date(stats.dateRange.from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — ${new Date(stats.dateRange.to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Timeline open";

  const verifiedPercent =
    stats.totalComparisons > 0
      ? Math.round((stats.verifiedComparisonsCount / stats.totalComparisons) * 100)
      : 0;

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
                  Analytics & Intelligence
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-400">{stats.projectName}</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
                Impact Dashboard
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
              href={`/projects/${projectId}/report`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Generate Impact Report</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Assets */}
          <div className="glass-panel rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Catalogued Media</span>
              <ImageIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalAssets}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
              <span>{stats.imageCount} images</span>
              <span>•</span>
              <span>{stats.videoCount} videos</span>
            </div>
          </div>

          {/* Card 2: Comparisons */}
          <div className="glass-panel rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Observation Pairs</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalComparisons}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="font-semibold text-emerald-400">{stats.verifiedComparisonsCount}</span>
              <span>AI-verified same scene</span>
            </div>
          </div>

          {/* Card 3: Verification Rate */}
          <div className="glass-panel rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Verification Rate</span>
              <ShieldCheck className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-white">{verifiedPercent}%</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats.totalComparisons > 0 ? "Multi-factor scene audit" : "No pairs linked yet"}
            </div>
          </div>

          {/* Card 4: Categories */}
          <div className="glass-panel rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Active Pillars</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {Object.keys(stats.categoryBreakdown).length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {Object.keys(stats.categoryBreakdown).slice(0, 2).join(", ")}
            </div>
          </div>

          {/* Card 5: Timeline Horizon */}
          <div className="glass-panel rounded-2xl p-4 border border-white/10 col-span-2 md:col-span-4 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Time Horizon</span>
              <Calendar className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xs font-semibold text-white truncate" title={dateSpanFormatted}>
              {dateSpanFormatted}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Grounded capture range</div>
          </div>
        </div>

        {/* Recharts Analytics Section */}
        <ImpactCharts
          categoryBreakdown={stats.categoryBreakdown}
          totalAssets={stats.totalAssets}
          totalComparisons={stats.totalComparisons}
          verifiedComparisonsCount={stats.verifiedComparisonsCount}
        />

        {/* Detailed Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Observation Pairs Health & Audit Summary (7 cols) */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Observation Pairs & Verification Status</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological proof tracking for longitudinal project milestones
                </p>
              </div>
              <Link
                href={`/projects/${projectId}?tab=comparisons`}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <span>View Pairs</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {stats.comparisons.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No before/after comparisons saved for this project yet. Use the Comparisons tab to link photo evidence.
              </div>
            ) : (
              <div className="space-y-3">
                {stats.comparisons.map((c: any) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {c.location ? `Observation at ${c.location}` : "Pair Observation"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          c.verified
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {c.verified ? "✓ AI-Verified Same Scene" : "Unverified"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span>Before: <strong className="text-slate-300">{c.beforeDate || "N/A"}</strong></span>
                      <span>After: <strong className="text-slate-300">{c.afterDate || "N/A"}</strong></span>
                      {c.matchConfidence !== null && (
                        <span>Confidence: <strong className="text-slate-300">{Math.round(c.matchConfidence * 100)}%</strong></span>
                      )}
                    </div>

                    {c.changeSummary && (
                      <p className="text-xs text-slate-300 bg-white/5 p-2 rounded-lg">
                        <strong>Change:</strong> {c.changeSummary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Locations & Project Site Distribution (5 cols) */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>Documented Field Locations</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Physical monitoring locations captured in metadata
              </p>
            </div>

            {stats.locations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No location tags specified in current assets.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.locations.map((loc: string, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-slate-200 capitalize">
                        {loc}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded">
                      Documented Site
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Direct Call to Action */}
            <div className="pt-4 border-t border-white/10">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/20 space-y-2">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Stakeholder Impact Intelligence</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Export an executive sustainability report grounded strictly in this project&apos;s verified timeline, empirical metrics, and before/after evidence.
                </p>
                <Link
                  href={`/projects/${projectId}/report`}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Report Builder</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
