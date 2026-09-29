"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Columns2, ExternalLink } from "lucide-react";
import { withTransformation, overlayId } from "@/lib/cloudinary-url";
import { COMPARE_FRAME, MetricKind } from "@/lib/change-metric";
import { CompareSlider } from "@/components/CompareSlider";
import { ChangeMeter } from "@/components/ChangeMeter";
import { ReelPanel } from "@/components/ReelPanel";
import { TrustBadge } from "@/components/TrustBadge";

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

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!data) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
      </div>
    );
  }

  const { comparison, before, after, reels } = data;
  // Identical framing for both photos (g_center, not g_auto, so crops line up).
  const framed = (url: string) => withTransformation(url, `${COMPARE_FRAME}/f_jpg,q_90`);
  const latest = comparison.metrics[0];
  const defaultKind: MetricKind = comparison.project.impactType === "WATER" ? "WATER_AREA" : "GREEN_COVER";

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href={`/projects/${projectId}/compare`} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4 text-emerald-400" /> All comparisons
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 uppercase tracking-wider">
            <Columns2 className="w-4 h-4" /> {comparison.project.name}
          </p>
          <h1 className="text-2xl font-extrabold text-white mt-1">
            {before.capturedAt?.slice(0, 10)} → {after.capturedAt?.slice(0, 10)}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href={`/verify/${before.id}`} target="_blank" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">
            Before <TrustBadge integrity={before.integrity} />
          </Link>
          <Link href={`/verify/${after.id}`} target="_blank" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">
            After <TrustBadge integrity={after.integrity} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompareSlider
          beforeUrl={framed(before.secureUrl)}
          afterUrl={framed(after.secureUrl)}
          beforeLabel={`Before · ${before.capturedAt?.slice(0, 10) ?? ""}`}
          afterLabel={`After · ${after.capturedAt?.slice(0, 10) ?? ""}`}
        />
        {latest?.maskPublicId ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withTransformation(after.secureUrl, `${COMPARE_FRAME}/l_${overlayId(latest.maskPublicId)},o_70/fl_layer_apply/f_auto,q_auto`)}
              alt="Change mask overlaid on the after photo"
              className="w-full aspect-[4/3] object-cover rounded-2xl border border-white/10"
            />
            <p className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
              <span>
                Saved: {latest.metric === "GREEN_COVER" ? "green cover" : "water area"} {latest.beforePct}% → {latest.afterPct}% (
                {latest.deltaPp > 0 ? "+" : ""}
                {latest.deltaPp} pp)
              </span>
              <span className="text-slate-500">· mask overlaid by Cloudinary (l_ … o_70), labelled an edited derivative</span>
              {latest.satDelta?.delta != null && (
                <span className={latest.satDelta.agrees ? "text-emerald-300" : "text-rose-300"}>
                  · Sentinel-2 {String(latest.satDelta.index).toUpperCase()} {latest.satDelta.before} → {latest.satDelta.after}
                </span>
              )}
              <Link href={`/verify/${after.id}`} target="_blank" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                <ExternalLink className="w-3 h-3" /> ledger
              </Link>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-xs text-slate-500 p-6 text-center">
            Measure the change below to get a pixel-level metric and a highlighted-regrowth view.
          </div>
        )}
      </div>

      <ChangeMeter
        comparisonId={comparison.id}
        beforeUrl={framed(before.secureUrl)}
        afterUrl={framed(after.secureUrl)}
        defaultKind={defaultKind}
        onSaved={() => load()}
      />

      <ReelPanel comparisonId={comparison.id} reels={reels} hasMetric={comparison.metrics.length > 0} />
    </div>
  );
}
