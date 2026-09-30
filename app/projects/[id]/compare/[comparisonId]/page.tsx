"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Droplets,
  ExternalLink,
  Leaf,
  MapPin,
  MoveHorizontal,
  Ruler,
  Satellite,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { withTransformation, overlayId, getThumbnailUrl } from "@/lib/cloudinary-url";
import { COMPARE_FRAME, MetricKind } from "@/lib/change-metric";
import { CompareSlider } from "@/components/CompareSlider";
import { ChangeMeter } from "@/components/ChangeMeter";
import { ReelPanel } from "@/components/ReelPanel";
import { TrustBadge } from "@/components/TrustBadge";
import { PageHeader, Loading, ErrorNote, IconChip, cx } from "@/components/ui";

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ComparisonDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const comparisonId = params.comparisonId as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/comparisons/${comparisonId}`);
    const json = await res.json();
    if (json.success) setData(json);
    else setError(json.error);
  }, [comparisonId]);

  useEffect(() => {
    load();
  }, [load]);

  const back = { href: `/projects/${projectId}`, label: "Back to project" };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader back={back} title="Comparison" />
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!data) return <Loading label="Loading comparison" />;

  const { comparison, before, after, reels } = data;
  // Identical framing for both photos (g_center, not g_auto, so crops line up).
  const framed = (url: string) => withTransformation(url, `${COMPARE_FRAME}/f_jpg,q_90`);
  const latest = comparison.metrics[0];
  const defaultKind: MetricKind = comparison.project.impactType === "WATER" ? "WATER_AREA" : "GREEN_COVER";

  const beforeDate = formatDate(before.capturedAt);
  const afterDate = formatDate(after.capturedAt);
  const metricLabel = latest?.metric === "GREEN_COVER" ? "Green cover" : "Water area";
  const deltaWord = !latest ? "" : latest.deltaPp > 0 ? "increased" : latest.deltaPp < 0 ? "decreased" : "stayed the same";
  const hasSat = latest?.satDelta?.delta != null;
  const location: string | null = before.manualLocation || after.manualLocation || null;

  const isGreen = latest?.metric === "GREEN_COVER";
  const up = latest ? latest.deltaPp > 0 : false;
  const down = latest ? latest.deltaPp < 0 : false;

  const photos = [
    { key: "before", label: "Before", asset: before, date: beforeDate },
    { key: "after", label: "After", asset: after, date: afterDate },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        back={back}
        eyebrow={comparison.project.name}
        title="Before and after"
        description={
          <>
            {location && <span className="capitalize">{location}</span>}
            {location && beforeDate && afterDate && " · "}
            {beforeDate && afterDate && (
              <span className="tabular-nums">
                {beforeDate} to {afterDate}
              </span>
            )}
            {!location && !(beforeDate && afterDate) && "Drag the handle across the photo to see what changed."}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        {/* Stage */}
        <div className="relative overflow-hidden rounded-2xl bg-zinc-950 p-2 shadow-[0_28px_56px_-28px_rgba(0,0,0,0.7)] ring-1 ring-zinc-900 sm:p-3 lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_220px_at_20%_0%,rgba(16,185,129,0.18),transparent_70%)]" />
          <div className="relative">
            <CompareSlider
              beforeUrl={framed(before.secureUrl)}
              afterUrl={framed(after.secureUrl)}
              beforeLabel="Before"
              afterLabel="After"
              beforeDate={before.capturedAt}
              afterDate={after.capturedAt}
            />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1.5 pb-1 pt-3 text-xs text-zinc-400">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                {location && (
                  <span className="inline-flex min-w-0 items-center gap-1.5 capitalize text-zinc-300">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    <span className="truncate">{location}</span>
                  </span>
                )}
                {comparison.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                    <CheckCircle2 className="h-3 w-3" /> Same place confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 font-medium text-zinc-400 ring-1 ring-inset ring-white/10">
                    Same place not confirmed
                  </span>
                )}
              </div>
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <MoveHorizontal className="h-3.5 w-3.5" /> Drag the handle to compare
              </span>
            </div>
          </div>
        </div>

        {/* Result + photos */}
        <div className="flex flex-col gap-5">
          {latest?.maskPublicId ? (
            <section className="card overflow-hidden">
              <div
                className={cx(
                  "relative bg-gradient-to-br p-5",
                  up ? "from-emerald-50 via-white to-white" : down ? "from-red-50/80 via-white to-white" : "from-zinc-50 via-white to-white",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <IconChip icon={isGreen ? Leaf : Droplets} tone={isGreen ? "emerald" : "sky"} size="sm" />
                    <h2 className="text-sm font-semibold text-zinc-900">Result</h2>
                  </div>
                  {hasSat && (
                    <span className={`badge ${latest.satDelta.agrees ? "badge-green" : "badge-amber"}`}>
                      <Satellite className="h-3 w-3" />
                      {latest.satDelta.agrees ? "Satellite agrees" : "Satellite disagrees"}
                    </span>
                  )}
                </div>

                <p className="mt-5 text-[13px] font-medium text-zinc-500">{metricLabel} in frame</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cx(
                      "text-5xl font-semibold leading-none tracking-tight tabular-nums",
                      latest.deltaPp >= 0 ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {latest.deltaPp > 0 ? "+" : ""}
                    {latest.deltaPp}
                  </span>
                  <span className="text-sm font-medium text-zinc-500">points</span>
                  {up && <TrendingUp className="h-5 w-5 self-center text-emerald-500" />}
                  {down && <TrendingDown className="h-5 w-5 self-center text-red-500" />}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  {metricLabel} {deltaWord}{" "}
                  {latest.deltaPp !== 0 ? `from ${latest.beforePct}% to ${latest.afterPct}%` : `at ${latest.afterPct}%`} of the
                  frame between the two photos.
                </p>

                <div className="mt-5 space-y-3">
                  {[
                    { label: "Before", pct: latest.beforePct, bar: "bg-zinc-300" },
                    { label: "After", pct: latest.afterPct, bar: isGreen ? "bg-emerald-500" : "bg-sky-500" },
                  ].map((row) => (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-600">{row.label}</span>
                        <span className="font-semibold tabular-nums text-zinc-900">{row.pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={cx("h-full rounded-full transition-all", row.bar)}
                          style={{ width: `${Math.max(0, Math.min(100, Number(row.pct)))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <figure className="space-y-2 border-t border-zinc-100 p-4">
                <div className="group relative overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={withTransformation(after.secureUrl, `${COMPARE_FRAME}/l_${overlayId(latest.maskPublicId)},o_70/fl_layer_apply/f_auto,q_auto`)}
                    alt="Change mask overlaid on the after photo"
                    className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="photo-chip absolute left-2.5 top-2.5">Changed areas</span>
                </div>
                <figcaption className="text-xs text-zinc-500">Changed areas highlighted on the after photo.</figcaption>
              </figure>

              {comparison.changeSummary && (
                <div className="flex gap-2.5 border-t border-zinc-100 px-5 py-4">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-violet-700">What the AI noticed</p>
                    <p className="text-sm leading-relaxed text-zinc-600">{comparison.changeSummary}</p>
                  </div>
                </div>
              )}

              <details className="group border-t border-zinc-100">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
                  Details
                  <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4 text-xs text-zinc-600">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
                    <dt className="text-zinc-500">Metric</dt>
                    <dd className="text-zinc-900">{metricLabel}</dd>
                    <dt className="text-zinc-500">Change</dt>
                    <dd className="tabular-nums text-zinc-900">
                      {latest.beforePct}% → {latest.afterPct}% ({latest.deltaPp > 0 ? "+" : ""}
                      {latest.deltaPp} pp)
                    </dd>
                    {hasSat && (
                      <>
                        <dt className="text-zinc-500">Sentinel-2</dt>
                        <dd className="tabular-nums text-zinc-900">
                          {String(latest.satDelta.index).toUpperCase()} {latest.satDelta.before} → {latest.satDelta.after}
                        </dd>
                      </>
                    )}
                  </dl>
                  <p>
                    The highlighted image is the change mask overlaid on the after photo by Cloudinary (l_ … o_70), and is
                    labelled as an edited derivative.
                  </p>
                  <Link
                    href={`/verify/${after.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-900"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View verification record
                  </Link>
                </div>
              </details>
            </section>
          ) : (
            <section className="card relative overflow-hidden bg-gradient-to-br from-emerald-50/70 via-white to-white p-5">
              <div className="flex items-center gap-2.5">
                <IconChip icon={Ruler} tone="emerald" size="sm" />
                <h2 className="text-sm font-semibold text-zinc-900">Result</h2>
              </div>
              <p className="mt-4 text-lg font-semibold tracking-tight text-zinc-900">No measurement yet</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                No measurement saved yet. Use the tool below to measure how much changed between the two photos.
              </p>
              {comparison.changeSummary && (
                <div className="mt-4 flex gap-2.5 rounded-xl bg-violet-50/70 px-3.5 py-3 ring-1 ring-inset ring-violet-600/10">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-violet-700">What the AI noticed</p>
                    <p className="text-sm leading-relaxed text-zinc-600">{comparison.changeSummary}</p>
                  </div>
                </div>
              )}
              <a href="#measure" className="btn btn-primary btn-sm mt-5">
                <Ruler className="h-3.5 w-3.5" /> Measure the change
              </a>
            </section>
          )}

          <section className="card divide-y divide-zinc-100">
            {photos.map(({ key, label, asset, date }) => (
              <Link
                key={key}
                href={`/verify/${asset.id}`}
                target="_blank"
                className="group flex items-center gap-3 px-4 py-3 transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-zinc-50"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getThumbnailUrl(asset.secureUrl, asset.resourceType)}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.08]"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                    {label}
                    <TrustBadge integrity={asset.integrity} />
                  </p>
                  <p className="text-xs tabular-nums text-zinc-500">{date ?? "Date unknown"}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-500 transition group-hover:text-zinc-900">
                  Verification
                  <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </section>
        </div>
      </div>

      <div id="measure" className="scroll-mt-24">
        <ChangeMeter
          comparisonId={comparison.id}
          beforeUrl={framed(before.secureUrl)}
          afterUrl={framed(after.secureUrl)}
          defaultKind={defaultKind}
          onSaved={() => load()}
        />
      </div>

      <ReelPanel comparisonId={comparison.id} reels={reels} hasMetric={comparison.metrics.length > 0} />
    </div>
  );
}
