"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Ruler, Save, Satellite, Layers } from "lucide-react";
import { measureChange, METHODS, MetricKind, ChangeResult } from "@/lib/change-metric";

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

  const label = kind === "GREEN_COVER" ? "Green cover" : "Water area";
  const slider = (key: "dx" | "dy" | "scale", min: number, max: number, step: number, text: string) => (
    <label className="flex items-center gap-2 text-[11px] text-slate-400">
      <span className="w-16 shrink-0">{text}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={align[key]}
        onChange={(e) => setAlign({ ...align, [key]: Number(e.target.value) })}
        className="flex-1 accent-emerald-500"
      />
      <span className="w-12 text-right font-mono text-slate-300">{key === "scale" ? align.scale.toFixed(3) : align[key]}</span>
    </label>
  );

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Ruler className="w-4 h-4 text-emerald-400" /> Measure the change
        </h3>
        <div className="flex items-center gap-1 text-xs">
          {(["GREEN_COVER", "WATER_AREA"] as MetricKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded-lg font-semibold ${kind === k ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
            >
              {k === "GREEN_COVER" ? "Green cover" : "Water area"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-2">
          <div className="relative">
            <canvas ref={previewRef} width={W} height={H} className="w-full rounded-xl border border-white/10 bg-black" />
            {!images && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {onion
              ? "Onion skin: the before photo at 50% over the after photo. Nudge until fixed features line up."
              : `Mask on the after photo: ${kind === "GREEN_COVER" ? "green" : "blue"} = gained, red = lost.`}
          </p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">{label} in frame</p>
              <p className="text-3xl font-black text-white tabular-nums">
                {result.beforePct}% → {result.afterPct}%
              </p>
              <p className={`text-lg font-bold ${result.deltaPp >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {result.deltaPp > 0 ? "+" : ""}
                {result.deltaPp} pp <span className="text-xs font-normal text-slate-400">{METHODS[kind].errorBand} expected error</span>
              </p>
              <p className="text-[10px] text-slate-500">{METHODS[kind].method}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              Align the before photo
              <label className="flex items-center gap-1.5 font-normal text-slate-400 cursor-pointer">
                <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} className="accent-emerald-500" />
                <Layers className="w-3 h-3" /> onion skin
              </label>
            </p>
            {slider("dx", -120, 120, 1, "Shift X")}
            {slider("dy", -120, 120, 1, "Shift Y")}
            {slider("scale", 0.85, 1.15, 0.005, "Scale")}
          </div>

          <button
            type="button"
            id="save-metric-btn"
            onClick={save}
            disabled={!result || saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save measurement to the ledger
          </button>

          {saved?.satDelta && (
            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-[11px] text-violet-200 flex gap-2">
              <Satellite className="w-4 h-4 shrink-0" />
              {saved.satDelta.error ? (
                <span>Satellite cross-check failed: {saved.satDelta.error}</span>
              ) : saved.satDelta.delta === null ? (
                <span>No cloud-free Sentinel-2 pass near one of the dates.</span>
              ) : (
                <span>
                  Sentinel-2 {String(saved.satDelta.index).toUpperCase()} at this point: {saved.satDelta.before} → {saved.satDelta.after}{" "}
                  {saved.satDelta.agrees ? "✓ agrees" : "✗ disagrees"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
