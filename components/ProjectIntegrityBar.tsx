"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  Loader2,
  Settings2,
  ListChecks,
  Link2,
  Save,
} from "lucide-react";
import type { MediaAssetItem } from "./GalleryGrid";
import { effectiveVerdict } from "./TrustBadge";

export interface ProjectIntegrityFields {
  id: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  impactType: "GREENING" | "WATER" | "INFRASTRUCTURE" | "COMMUNITY" | "OTHER";
  claim: string | null;
}

interface Props {
  project: ProjectIntegrityFields;
  assets: MediaAssetItem[];
  verdictFilter: string;
  onVerdictFilter: (v: string) => void;
  onAssetsVerified: () => void;
  onProjectUpdated: (p: ProjectIntegrityFields) => void;
}

const IMPACT_LABELS: Record<ProjectIntegrityFields["impactType"], string> = {
  GREENING: "Greening (plantation, forest, mangroves)",
  WATER: "Water (ponds, check dams, recharge)",
  INFRASTRUCTURE: "Infrastructure (built structures)",
  COMMUNITY: "Community programme",
  OTHER: "Other",
};

export function ProjectIntegrityBar({ project, assets, verdictFilter, onVerdictFilter, onAssetsVerified, onProjectUpdated }: Props) {
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({
    latitude: project.latitude?.toString() ?? "",
    longitude: project.longitude?.toString() ?? "",
    geofenceRadiusM: project.geofenceRadiusM.toString(),
    impactType: project.impactType,
    claim: project.claim ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const counts = { VERIFIED: 0, REVIEW: 0, FLAGGED: 0, UNVERIFIED: 0 };
  for (const a of assets) {
    const v = effectiveVerdict(a.integrity);
    counts[v ?? "UNVERIFIED"]++;
  }

  const verifyAll = async () => {
    const pending = assets.filter((a) => !a.integrity || a.integrity.status !== "DONE");
    if (pending.length === 0) return;
    setVerifyingAll(true);
    setProgress({ done: 0, total: pending.length });
    // Sequential on purpose: external checks have per-minute quotas.
    for (const a of pending) {
      await fetch(`/api/assets/${a.id}/verify`, { method: "POST" }).catch(() => null);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setVerifyingAll(false);
    onAssetsVerified();
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: form.latitude === "" ? null : form.latitude,
          longitude: form.longitude === "" ? null : form.longitude,
          geofenceRadiusM: form.geofenceRadiusM,
          impactType: form.impactType,
          claim: form.claim,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save");
      onProjectUpdated(data.project);
      setShowSettings(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const chip = (key: string, label: string, n: number, Icon: any, cls: string) => (
    <button
      key={key}
      type="button"
      onClick={() => onVerdictFilter(verdictFilter === key ? "ALL" : key)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
        verdictFilter === key ? "ring-2 ring-white/30" : ""
      } ${cls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {n} {label}
    </button>
  );

  const pendingCount = assets.filter((a) => !a.integrity || a.integrity.status !== "DONE").length;

  return (
    <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Integrity</span>
          {chip("VERIFIED", "verified", counts.VERIFIED, ShieldCheck, "bg-emerald-500/10 text-emerald-300 border-emerald-500/30")}
          {chip("REVIEW", "review", counts.REVIEW, ShieldAlert, "bg-amber-500/10 text-amber-300 border-amber-500/30")}
          {chip("FLAGGED", "flagged", counts.FLAGGED, ShieldX, "bg-rose-500/10 text-rose-300 border-rose-500/30")}
          {chip("UNVERIFIED", "unverified", counts.UNVERIFIED, ShieldQuestion, "bg-slate-800 text-slate-300 border-white/10")}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            id="verify-all-btn"
            onClick={verifyAll}
            disabled={verifyingAll || pendingCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 transition"
          >
            {verifyingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {verifyingAll ? `Verifying ${progress.done}/${progress.total}` : `Verify ${pendingCount} unverified`}
          </button>
          <Link href={`/review?projectId=${project.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200">
            <ListChecks className="w-3.5 h-3.5 text-amber-300" /> Review queue
          </Link>
          <Link href={`/ledger?projectId=${project.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200">
            <Link2 className="w-3.5 h-3.5 text-slate-300" /> Ledger
          </Link>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200"
          >
            <Settings2 className="w-3.5 h-3.5" /> Site & claim
          </button>
        </div>
      </div>

      {!project.claim || project.latitude == null ? (
        <p className="text-[11px] text-amber-300/90">
          Add the project&apos;s site coordinates and impact claim under &ldquo;Site &amp; claim&rdquo; so the geofence, weather,
          satellite and AI-auditor checks can run.
        </p>
      ) : null}

      {showSettings && (
        <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-6 gap-3 pt-3 border-t border-white/10 text-xs">
          {error && <div className="md:col-span-6 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">{error}</div>}
          <label className="md:col-span-1 space-y-1">
            <span className="text-slate-400">Site latitude</span>
            <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="23.843" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-100" />
          </label>
          <label className="md:col-span-1 space-y-1">
            <span className="text-slate-400">Site longitude</span>
            <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="73.715" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-100" />
          </label>
          <label className="md:col-span-1 space-y-1">
            <span className="text-slate-400">Geofence radius (m)</span>
            <input value={form.geofenceRadiusM} onChange={(e) => setForm({ ...form, geofenceRadiusM: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-100" />
          </label>
          <label className="md:col-span-3 space-y-1">
            <span className="text-slate-400">Impact type (decides the satellite index)</span>
            <select value={form.impactType} onChange={(e) => setForm({ ...form, impactType: e.target.value as any })} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-100">
              {Object.entries(IMPACT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="md:col-span-5 space-y-1">
            <span className="text-slate-400">Impact claim (the AI auditor checks each photo against this)</span>
            <input value={form.claim} onChange={(e) => setForm({ ...form, claim: e.target.value })} placeholder="Built a stone check dam across the seasonal stream, with water stored behind it" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-100" />
          </label>
          <div className="md:col-span-1 flex items-end">
            <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
