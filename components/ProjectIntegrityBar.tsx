"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Inbox, Loader2, MapPin, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import type { MediaAssetItem } from "./GalleryGrid";
import { effectiveVerdict } from "./TrustBadge";
import { ErrorNote, Menu, Modal, Ring, cx } from "./ui";

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

const SEGMENTS = [
  { key: "VERIFIED", label: "Verified", bar: "bg-emerald-500" },
  { key: "REVIEW", label: "Needs review", bar: "bg-amber-400" },
  { key: "FLAGGED", label: "Flagged", bar: "bg-red-500" },
  { key: "UNVERIFIED", label: "Unverified", bar: "bg-zinc-300" },
] as const;

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

  const verifyAll = async (all = false) => {
    // all=true re-runs every asset (e.g. after new checks were switched on)
    const pending = all ? assets : assets.filter((a) => !a.integrity || a.integrity.status !== "DONE");
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

  const pendingCount = assets.filter((a) => !a.integrity || a.integrity.status !== "DONE").length;
  const total = assets.length;
  const needsSetup = !project.claim || project.latitude == null;
  const verifiedPct = total ? Math.round((counts.VERIFIED / total) * 100) : 0;

  let summary = `${counts.VERIFIED} of ${total} ${total === 1 ? "file is" : "files are"} verified`;
  if (counts.REVIEW) summary += `, ${counts.REVIEW} ${counts.REVIEW === 1 ? "needs" : "need"} review`;
  if (counts.FLAGGED) summary += `, ${counts.FLAGGED} flagged`;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <Ring value={verifiedPct} size={84} stroke={8}>
          <div className="text-center leading-none">
            <p className="text-lg font-semibold tabular-nums text-zinc-900">{verifiedPct}%</p>
            <p className="mt-0.5 text-[10px] font-medium text-zinc-400">verified</p>
          </div>
        </Ring>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Verification
              </h2>
              <p className="mt-0.5 text-sm tabular-nums text-zinc-500">
                {total === 0 ? "Upload media and every file is checked automatically." : `${summary}.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="verify-all-btn"
                onClick={() => verifyAll(false)}
                disabled={verifyingAll || pendingCount === 0}
                className="btn btn-primary btn-sm"
              >
                {verifyingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {verifyingAll
                  ? `Verifying ${progress.done}/${progress.total}`
                  : pendingCount === 0
                    ? "All checked"
                    : `Verify ${pendingCount} ${pendingCount === 1 ? "file" : "files"}`}
              </button>
              <Menu label="Verification options" buttonClassName="btn btn-secondary btn-sm btn-icon">
                <button
                  type="button"
                  id="reverify-all-btn"
                  onClick={() => verifyAll(true)}
                  disabled={verifyingAll || assets.length === 0}
                  className="menu-item disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4 text-zinc-400" />
                  Re-check all files
                </button>
                <button type="button" onClick={() => setShowSettings(true)} className="menu-item">
                  <Settings2 className="h-4 w-4 text-zinc-400" />
                  Site &amp; claim
                </button>
                <div className="my-1 border-t border-zinc-100" />
                <Link href={`/review?projectId=${project.id}`} className="menu-item">
                  <Inbox className="h-4 w-4 text-zinc-400" />
                  Open review queue
                </Link>
                <Link href={`/ledger?projectId=${project.id}`} className="menu-item">
                  <History className="h-4 w-4 text-zinc-400" />
                  View audit trail
                </Link>
              </Menu>
            </div>
          </div>

          {total > 0 && (
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              {SEGMENTS.map((s) =>
                counts[s.key] ? (
                  <div
                    key={s.key}
                    className={cx("transition-all", s.bar)}
                    style={{ width: `${(counts[s.key] / total) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-2 border-t border-zinc-100 bg-zinc-50/60 sm:grid-cols-4">
          {SEGMENTS.map((s, i) => {
            const active = verdictFilter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onVerdictFilter(active ? "ALL" : s.key)}
                aria-pressed={active}
                title={active ? "Show all files" : `Show only ${s.label.toLowerCase()} files`}
                className={cx(
                  "flex items-center justify-between gap-2 px-5 py-3 text-left transition",
                  i > 0 && "sm:border-l sm:border-zinc-100",
                  i % 2 === 1 && "border-l border-zinc-100",
                  i > 1 && "border-t border-zinc-100 sm:border-t-0",
                  active ? "bg-white shadow-[inset_0_-2px_0_0_#10b981]" : "hover:bg-white",
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-600">
                  <span className={cx("h-2 w-2 rounded-full", s.bar)} />
                  {s.label}
                </span>
                <span className="text-base font-semibold tabular-nums text-zinc-900">{counts[s.key]}</span>
              </button>
            );
          })}
        </div>
      )}

      {needsSetup && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 bg-amber-50/70 px-5 py-3 text-[13px] text-amber-900 sm:px-6">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-amber-600" />
            Add the site location and what the project claims, so location, weather and satellite checks can run.
          </span>
          <button type="button" onClick={() => setShowSettings(true)} className="btn btn-secondary btn-sm">
            Set up site
          </button>
        </div>
      )}

      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        icon={MapPin}
        tone="sky"
        title="Site & claim"
        description="Used to confirm photos were taken at the site and actually show what the project claims."
        footer={
          <>
            <button type="button" onClick={() => setShowSettings(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button type="submit" form="site-claim-form" disabled={saving} className="btn btn-primary btn-sm">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </>
        }
      >
        <form id="site-claim-form" onSubmit={saveSettings} className="space-y-4">
          <ErrorNote>{error}</ErrorNote>
          <div>
            <label className="label" htmlFor="site-claim">
              What does the project claim?
            </label>
            <textarea
              id="site-claim"
              rows={2}
              value={form.claim}
              onChange={(e) => setForm({ ...form, claim: e.target.value })}
              placeholder="Built a stone check dam across the seasonal stream, with water stored behind it"
              className="input"
            />
            <p className="mt-1 text-xs text-zinc-500">Each photo is checked against this statement.</p>
          </div>
          <div>
            <label className="label" htmlFor="site-type">
              Project type
            </label>
            <select
              id="site-type"
              value={form.impactType}
              onChange={(e) => setForm({ ...form, impactType: e.target.value as any })}
              className="input"
            >
              {Object.entries(IMPACT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">Decides which satellite measurement is used.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="site-lat">
                Latitude
              </label>
              <input
                id="site-lat"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="23.843"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="site-lng">
                Longitude
              </label>
              <input
                id="site-lng"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="73.715"
                className="input"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="site-radius">
                Site radius (m)
              </label>
              <input
                id="site-radius"
                value={form.geofenceRadiusM}
                onChange={(e) => setForm({ ...form, geofenceRadiusM: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
