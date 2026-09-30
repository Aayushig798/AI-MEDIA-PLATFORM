"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Columns2,
  FileText,
  Images,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react";
import { ImpactCharts } from "@/components/ImpactCharts";
import { IntegritySummaryCards } from "@/components/IntegritySummaryCards";
import { ImpactMap } from "@/components/ImpactMap";
import { PageHeader, ErrorNote, Stat, SectionHeader, IconChip, EmptyState } from "@/components/ui";

/** "2025-03-14" -> "Mar 14, 2025" (dates arrive as plain calendar days). */
function dayLabel(d: string | null) {
  if (!d) return "Unknown date";
  const date = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

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

  const back = { href: `/projects/${projectId}`, label: "Back to project" };

  if (loading && !stats) {
    return (
      <div className="space-y-8" aria-busy="true">
        <span className="sr-only">Loading insights</span>
        <div className="flex items-center gap-4">
          <div className="skeleton hidden h-12 w-12 rounded-2xl sm:block" />
          <div className="space-y-2">
            <div className="skeleton h-3.5 w-32 rounded" />
            <div className="skeleton h-7 w-48 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="skeleton h-[118px] rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="skeleton h-80 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader back={back} title="Insights" />
        <div className="card max-w-md space-y-4 p-5">
          <ErrorNote>{error || "Project data is not available."}</ErrorNote>
          <button type="button" onClick={fetchStats} className="btn btn-secondary btn-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const dateSpanFormatted = stats.dateRange
    ? `${new Date(stats.dateRange.from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — ${new Date(stats.dateRange.to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Timeline open";

  const verifiedPercent =
    stats.totalComparisons > 0
      ? Math.round((stats.verifiedComparisonsCount / stats.totalComparisons) * 100)
      : 0;

  const categories = Object.keys(stats.categoryBreakdown);
  const avgTrust: number | null = stats.integrity?.averageTrustScore ?? null;

  return (
    <div className="space-y-10">
      <PageHeader
        back={back}
        eyebrow={stats.projectName}
        title="Insights"
        description="Key numbers and evidence for this project, in one place."
        actions={
          <Link href={`/projects/${projectId}/report`} className="btn btn-primary">
            <FileText className="h-4 w-4" />
            Create report
          </Link>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Photos and videos"
          value={stats.totalAssets}
          icon={Images}
          tone="emerald"
          hint={`${stats.imageCount} photos · ${stats.videoCount} videos`}
        />
        <Stat
          label="Before-and-after pairs"
          value={stats.totalComparisons}
          icon={Columns2}
          tone="violet"
          progress={stats.totalComparisons > 0 ? verifiedPercent : undefined}
          hint={
            stats.totalComparisons > 0
              ? `${stats.verifiedComparisonsCount} confirmed same place (${verifiedPercent}%)`
              : "No pairs yet"
          }
        />
        {avgTrust != null ? (
          <Stat
            label="Average trust score"
            value={
              <>
                {avgTrust}
                <span className="ml-0.5 text-base font-medium text-zinc-400">/100</span>
              </>
            }
            icon={ShieldCheck}
            tone="emerald"
            progress={avgTrust}
            hint={`${stats.integrity.verified} of ${stats.totalAssets} items verified`}
          />
        ) : (
          <Stat
            label="Categories"
            value={categories.length}
            icon={Tags}
            tone="zinc"
            hint={<span className="block truncate">{categories.slice(0, 2).join(", ") || "None yet"}</span>}
          />
        )}
        <Stat
          label="Time span"
          icon={CalendarRange}
          tone="sky"
          value={
            stats.dateRange ? (
              <span className="block truncate text-lg" title={dateSpanFormatted}>
                {shortDate(stats.dateRange.from)} – {shortDate(stats.dateRange.to)}
              </span>
            ) : (
              <span className="text-lg text-zinc-400">No dates</span>
            )
          }
          hint="When photos were taken"
        />
      </div>

      <ImpactCharts
        categoryBreakdown={stats.categoryBreakdown}
        totalAssets={stats.totalAssets}
        totalComparisons={stats.totalComparisons}
        verifiedComparisonsCount={stats.verifiedComparisonsCount}
      />

      <IntegritySummaryCards facts={stats} projectId={projectId} />

      <section className="card overflow-hidden">
        <div className="p-5 pb-4">
          <SectionHeader
            icon={MapPin}
            tone="sky"
            title="Map"
            description="Where the verified photos were taken."
            actions={
              stats.locations.length > 0 ? (
                <span className="badge badge-blue tabular-nums">
                  {stats.locations.length} location{stats.locations.length === 1 ? "" : "s"}
                </span>
              ) : undefined
            }
          />
        </div>
        <div className="px-2 pb-2">
          <ImpactMap projectId={projectId} height={380} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="card flex flex-col lg:col-span-7">
          <div className="p-5">
            <SectionHeader
              icon={Columns2}
              tone="violet"
              title="Before-and-after pairs"
              description="Photos of the same place, taken at different times."
              actions={
                <Link href={`/projects/${projectId}?tab=comparisons`} className="btn btn-ghost btn-sm">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
          </div>

          {stats.comparisons.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={Columns2}
                title="No pairs yet"
                description="No before-and-after pairs yet. Save one from the project's Comparisons tab."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
              {stats.comparisons.map((c: any) => (
                <li key={c.id} className="last:overflow-hidden last:rounded-b-2xl">
                  <Link
                    href={`/projects/${projectId}/compare/${c.id}`}
                    className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-zinc-50"
                  >
                    <IconChip icon={c.verified ? CheckCircle2 : Columns2} tone={c.verified ? "emerald" : "zinc"} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 truncate text-sm font-medium capitalize text-zinc-900">
                          {c.location || "Before and after"}
                        </span>
                        <span
                          className={`badge shrink-0 ${c.verified ? "badge-green" : "badge-neutral"}`}
                          title="Whether both photos were confirmed to show the same place"
                        >
                          {c.verified ? "Same place confirmed" : "Not confirmed"}
                        </span>
                      </div>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-zinc-500">
                        <span>{dayLabel(c.beforeDate)}</span>
                        <ArrowRight className="h-3 w-3 text-zinc-400" />
                        <span>{dayLabel(c.afterDate)}</span>
                        {c.matchConfidence !== null && (
                          <span className="ml-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">
                            Match {Math.round(c.matchConfidence * 100)}%
                          </span>
                        )}
                      </p>
                      {c.changeSummary && (
                        <p className="flex gap-1.5 text-sm leading-relaxed text-zinc-600">
                          <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-violet-500" />
                          <span className="line-clamp-2">{c.changeSummary}</span>
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col lg:col-span-5">
          <div className="p-5">
            <SectionHeader
              icon={MapPin}
              tone="sky"
              title="Locations"
              description="Places named on this project's media."
              actions={
                stats.locations.length > 0 ? (
                  <span className="badge badge-neutral tabular-nums">{stats.locations.length}</span>
                ) : undefined
              }
            />
          </div>
          {stats.locations.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={MapPin}
                title="No locations yet"
                description="No locations added to this project's media yet."
              />
            </div>
          ) : (
            <ul className="max-h-[440px] divide-y divide-zinc-100 overflow-y-auto rounded-b-2xl border-t border-zinc-100">
              {stats.locations.map((loc: string, i: number) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <IconChip icon={MapPin} tone="sky" size="sm" />
                  <span className="min-w-0 truncate text-sm font-medium capitalize text-zinc-800">{loc}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
