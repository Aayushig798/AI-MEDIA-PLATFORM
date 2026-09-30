"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Droplets, Info, Leaf, Loader2, Ruler, Satellite, SlidersHorizontal } from "lucide-react";
import { measureChange, METHODS, MetricKind, ChangeResult } from "@/lib/change-metric";
import { SectionHeader, Tabs, ErrorNote, cx } from "@/components/ui";

const W = 1024;
const H = 768;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // res.cloudinary.com sends Access-Control-Allow-Origin: *
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

interface SavedMetric {
  id: string;
  metric: MetricKind;
  beforePct: number;
  afterPct: number;
  deltaPp: number;
  satDelta?: any;
}

/**
 * Measures green cover / water area on aligned frames in the browser. The
 * after photo is fixed; the before photo is nudged onto it, so the change mask
 * lives in the after photo's frame (and can be overlaid on it by Cloudinary).
 */
export function ChangeMeter({
  comparisonId,
  beforeUrl,
  afterUrl,
  defaultKind,
  onSaved,
}: {
  comparisonId: string;
  beforeUrl: string;
  afterUrl: string;
  defaultKind: MetricKind;
  onSaved: (m: SavedMetric) => void;
}) {
  const [kind, setKind] = useState<MetricKind>(defaultKind);
  const [align, setAlign] = useState({ dx: 0, dy: 0, scale: 1 });
  const [onion, setOnion] = useState(false);
  const [images, setImages] = useState<{ before: HTMLImageElement; after: HTMLImageElement } | null>(null);
  const [result, setResult] = useState<ChangeResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedMetric | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all([loadImage(beforeUrl), loadImage(afterUrl)])
      .then(([before, after]) => setImages({ before, after }))
      .catch((e) => setError(e.message));
  }, [beforeUrl, afterUrl]);

  const compute = useCallback(() => {
    if (!images) return;
    const make = () => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      return c;
    };
    const afterCanvas = make();
    const actx = afterCanvas.getContext("2d", { willReadFrequently: true })!;
    actx.drawImage(images.after, 0, 0, W, H);

    const beforeCanvas = make();
    const bctx = beforeCanvas.getContext("2d", { willReadFrequently: true })!;
    bctx.translate(W / 2 + align.dx, H / 2 + align.dy);
    bctx.scale(align.scale, align.scale);
    bctx.drawImage(images.before, -W / 2, -H / 2, W, H);

    const res = measureChange(bctx.getImageData(0, 0, W, H), actx.getImageData(0, 0, W, H), kind);
    setResult(res);
    setSaved(null);

    // Preview: after photo + mask (or onion-skin before for alignment).
    const preview = previewRef.current;
    if (!preview) return;
    const pctx = preview.getContext("2d")!;
    pctx.clearRect(0, 0, W, H);
    pctx.drawImage(afterCanvas, 0, 0);
    if (onion) {
      pctx.globalAlpha = 0.5;
      pctx.drawImage(beforeCanvas, 0, 0);
      pctx.globalAlpha = 1;
    } else {
      const maskCanvas = make();
      maskCanvas.getContext("2d")!.putImageData(res.mask, 0, 0);
      pctx.globalAlpha = 0.75;
      pctx.drawImage(maskCanvas, 0, 0);
      pctx.globalAlpha = 1;
    }
  }, [images, align, kind, onion]);

  useEffect(() => {
    const t = setTimeout(compute, 120);
    return () => clearTimeout(t);
  }, [compute]);

  const save = async () => {
    if (!result) return;
    try {
      setSaving(true);
      setError("");
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = W;
      maskCanvas.height = H;
      maskCanvas.getContext("2d")!.putImageData(result.mask, 0, 0);
      const res = await fetch(`/api/comparisons/${comparisonId}/metric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric: kind,
          beforePct: result.beforePct,
          afterPct: result.afterPct,
          maskDataUrl: maskCanvas.toDataURL("image/png"),
          alignment: { ...align, frame: `${W}x${H}` },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save measurement");
      setSaved(data.metric);
      onSaved(data.metric);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isGreen = kind === "GREEN_COVER";
  const label = isGreen ? "Green cover" : "Water area";
  const gainedColor = isGreen ? "rgb(16,255,140)" : "rgb(40,170,255)";
  const aligned = align.dx !== 0 || align.dy !== 0 || align.scale !== 1;

  const slider = (key: "dx" | "dy" | "scale", min: number, max: number, step: number, text: string) => (
    <label className="flex items-center gap-3 text-[13px] text-zinc-600">
      <span className="w-20 shrink-0">{text}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={align[key]}
        onChange={(e) => setAlign({ ...align, [key]: Number(e.target.value) })}
        className="min-w-0 flex-1 accent-emerald-600"
      />
      <span className="w-12 text-right text-xs tabular-nums text-zinc-500">
        {key === "scale" ? align.scale.toFixed(3) : align[key]}
      </span>
    </label>
  );

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Ruler}
        tone="emerald"
        title="Measure the change"
        description={`How much of the frame is ${isGreen ? "green cover" : "water"} in each photo.`}
        actions={
          <Tabs<MetricKind>
            value={kind}
            onChange={setKind}
            items={[
              { value: "GREEN_COVER", label: "Green cover", icon: Leaf },
              { value: "WATER_AREA", label: "Water area", icon: Droplets },
            ]}
          />
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          {/* Preview stage */}
          <div className="space-y-3 bg-zinc-950 p-2 sm:p-3 lg:col-span-3">
            <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10">
              <canvas ref={previewRef} width={W} height={H} className="block w-full bg-zinc-900" />
              {!images && !error && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Loading photos
                </div>
              )}
              {images && (
                <span className="photo-chip absolute left-2.5 top-2.5">{onion ? "Both photos overlaid" : "After photo"}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1.5 pb-1 text-xs text-zinc-400">
              {onion ? (
                <span>Both photos overlaid. Adjust until fixed features, like buildings or rocks, line up.</span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: gainedColor }} />
                    Gained
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(255,64,64)" }} />
                    Lost
                  </span>
                  <span className="text-zinc-500">Highlighted on the after photo</span>
                </>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-5 border-t border-zinc-100 p-5 lg:col-span-2 lg:border-l lg:border-t-0">
            {result ? (
              <div className="rounded-xl bg-gradient-to-br from-zinc-50 to-white p-4 ring-1 ring-inset ring-zinc-200/80">
                <p className="text-[13px] font-medium text-zinc-500">{label} in frame</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span
                    className={cx(
                      "text-4xl font-semibold leading-none tracking-tight tabular-nums",
                      result.deltaPp >= 0 ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {result.deltaPp > 0 ? "+" : ""}
                    {result.deltaPp}
                  </span>
                  <span className="text-sm font-medium text-zinc-500">points</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { name: "Before", pct: result.beforePct, bar: "bg-zinc-300" },
                    { name: "After", pct: result.afterPct, bar: isGreen ? "bg-emerald-500" : "bg-sky-500" },
                  ].map((row) => (
                    <div key={row.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">{row.name}</span>
                        <span className="font-semibold tabular-nums text-zinc-900">{row.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={cx("h-full rounded-full transition-all duration-300", row.bar)}
                          style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500">Margin of error {METHODS[kind].errorBand}</p>
              </div>
            ) : error ? null : (
              <div className="space-y-3 rounded-xl p-4 ring-1 ring-inset ring-zinc-200/80">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-9 w-32 rounded-lg" />
                <div className="skeleton h-1.5 w-full rounded-full" />
                <div className="skeleton h-1.5 w-full rounded-full" />
              </div>
            )}

            <details className="group rounded-xl border border-zinc-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
                  Adjust alignment
                  {aligned && <span className="badge badge-green">Adjusted</span>}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-zinc-100 px-4 py-3">
                <p className="text-xs leading-relaxed text-zinc-500">
                  If the photos were taken from slightly different spots, move the before photo until they line up.
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={onion}
                    onChange={(e) => setOnion(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-emerald-600"
                  />
                  Show both photos overlaid
                </label>
                {slider("dx", -120, 120, 1, "Left / right")}
                {slider("dy", -120, 120, 1, "Up / down")}
                {slider("scale", 0.85, 1.15, 0.005, "Zoom")}
              </div>
            </details>

            <div className="space-y-2">
              <button
                type="button"
                id="save-metric-btn"
                onClick={save}
                disabled={!result || saving}
                className="btn btn-primary btn-lg w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save measurement
              </button>
              <p className="text-center text-xs text-zinc-500">
                Saved measurements are added to the project record and used in reports.
              </p>
            </div>

            {saved?.satDelta &&
              (saved.satDelta.error ? (
                <div className="flex gap-2.5 rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-700 ring-1 ring-inset ring-zinc-200">
                  <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <span>Satellite check could not run: {saved.satDelta.error}</span>
                </div>
              ) : saved.satDelta.delta === null ? (
                <div className="flex gap-2.5 rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-700 ring-1 ring-inset ring-zinc-200">
                  <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <span>No clear satellite image near one of the dates, so the satellite check was skipped.</span>
                </div>
              ) : (
                <div
                  className={`flex gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1 ring-inset ${
                    saved.satDelta.agrees
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-600/15"
                      : "bg-amber-50 text-amber-800 ring-amber-600/20"
                  }`}
                >
                  {saved.satDelta.agrees ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {saved.satDelta.agrees ? "Satellite imagery agrees with this change." : "Satellite imagery does not agree with this change."}
                    <span className="block text-xs opacity-80">
                      Sentinel-2 {String(saved.satDelta.index).toUpperCase()} at this spot: {saved.satDelta.before} → {saved.satDelta.after}
                    </span>
                  </span>
                </div>
              ))}

            <details className="group rounded-xl border border-zinc-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <Info className="h-4 w-4 text-zinc-400" />
                  How this is measured
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-1.5 border-t border-zinc-100 px-4 py-3 text-xs leading-relaxed text-zinc-600">
                <p>{METHODS[kind].method}</p>
                <p>Expected error: {METHODS[kind].errorBand}. Results are in percentage points of the frame.</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
