"use client";

import { useEffect, useState, useCallback, type ComponentType } from "react";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  Check,
  X,
  ShieldCheck,
  ShieldX,
  Upload,
  Tags,
  ScanSearch,
  Columns2,
  PencilLine,
  UserCheck,
  Copy,
  Ruler,
  Clapperboard,
  FileText,
  FilePen,
  Trash2,
  Bell,
  Lock,
  History,
  Layers,
  Clock,
  Hourglass,
  ExternalLink,
} from "lucide-react";
import { verifyChain, merkleRoot, ChainVerification, LedgerEntryLike } from "@/lib/ledger-core";
import { ErrorNote, IconChip, Stat, Tabs, cx, type Tone } from "@/components/ui";

interface Entry extends LedgerEntryLike {
  id: string;
}
interface AnchorRow {
  id: string;
  externalRef?: string | null;
  fromSeq: number;
  toSeq: number;
  entryCount: number;
  root: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  ASSET_UPLOADED: "Uploaded",
  AI_TAGGED: "Tagged automatically",
  EMBEDDED: "Indexed for search",
  USED_IN_COMPARISON: "Used in a comparison",
  METADATA_EDITED: "Details edited",
  INTEGRITY_CHECKED: "Checked",
  REVIEW_DECISION: "Reviewed",
  DERIVATIVE_ISSUED: "Copy created",
  COMPARISON_CREATED: "Comparison created",
  METRIC_MEASURED: "Change measured",
  REEL_RENDERED: "Video created",
  REPORT_GENERATED: "Used in a report",
  REPORT_EDITED: "Report edited",
  ASSET_DELETED: "Deleted",
  CLOUDINARY_NOTIFICATION: "Storage notification",
  ANCHOR: "Sealed",
};

const VERDICT_TEXT: Record<string, string> = {
  VERIFIED: "Verified",
  REVIEW: "Needs review",
  FLAGGED: "Flagged",
};

type Group = "photos" | "checks" | "reviews" | "reports" | "seals";
type IconType = ComponentType<{ className?: string }>;

/** Icon, colour and filter group for each kind of entry. Colour follows meaning. */
const TYPE_META: Record<string, { icon: IconType; tone: Tone; group: Group }> = {
  ASSET_UPLOADED: { icon: Upload, tone: "emerald", group: "photos" },
  AI_TAGGED: { icon: Tags, tone: "violet", group: "photos" },
  EMBEDDED: { icon: ScanSearch, tone: "violet", group: "photos" },
  METADATA_EDITED: { icon: PencilLine, tone: "zinc", group: "photos" },
  DERIVATIVE_ISSUED: { icon: Copy, tone: "sky", group: "photos" },
  ASSET_DELETED: { icon: Trash2, tone: "red", group: "photos" },
  CLOUDINARY_NOTIFICATION: { icon: Bell, tone: "zinc", group: "photos" },
  INTEGRITY_CHECKED: { icon: ShieldCheck, tone: "emerald", group: "checks" },
  METRIC_MEASURED: { icon: Ruler, tone: "sky", group: "checks" },
  REVIEW_DECISION: { icon: UserCheck, tone: "amber", group: "reviews" },
  USED_IN_COMPARISON: { icon: Columns2, tone: "sky", group: "reports" },
  COMPARISON_CREATED: { icon: Columns2, tone: "sky", group: "reports" },
  REEL_RENDERED: { icon: Clapperboard, tone: "violet", group: "reports" },
  REPORT_GENERATED: { icon: FileText, tone: "violet", group: "reports" },
  REPORT_EDITED: { icon: FilePen, tone: "violet", group: "reports" },
  ANCHOR: { icon: Lock, tone: "emerald", group: "seals" },
};

const FILTERS: { value: "all" | Group; label: string }[] = [
  { value: "all", label: "All" },
  { value: "photos", label: "Photos" },
  { value: "checks", label: "Checks" },
  { value: "reviews", label: "Reviews" },
  { value: "reports", label: "Reports" },
  { value: "seals", label: "Seals" },
];

function metaFor(e: Entry): { icon: IconType; tone: Tone; group: Group | null } {
  const meta = TYPE_META[e.type];
  if (!meta) return { icon: History, tone: "zinc", group: null };
  if (e.type === "INTEGRITY_CHECKED") {
    const verdict = ((e.payload ?? {}) as Record<string, any>).verdict;
    if (verdict === "REVIEW") return { ...meta, tone: "amber" };
    if (verdict === "FLAGGED") return { ...meta, icon: ShieldX, tone: "red" };
  }
  return meta;
}

function short(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/** "5 min ago", "3 days ago", or a date for anything older than a week. */
function timeAgo(d: string | Date): string {
  const minutes = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function dayLabel(d: string | Date): string {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Plain-language summary of an entry. */
function describe(e: Entry): string {
  const p = (e.payload ?? {}) as Record<string, any>;
  switch (e.type) {
    case "INTEGRITY_CHECKED":
      return `${VERDICT_TEXT[p.verdict] ?? p.verdict ?? "Done"} · trust score ${p.trustScore}/100`;
    case "REVIEW_DECISION":
      return `${String(p.decision).toLowerCase()}${p.note ? ` — ${p.note}` : ""}`;
    case "DERIVATIVE_ISSUED":
      return p.class === "TRANSCODED" ? "resized copy, still valid evidence" : "edited copy, illustrative only";
    case "METRIC_MEASURED":
      return `${p.metric}: ${p.beforePct}% → ${p.afterPct}% (${p.deltaPp > 0 ? "+" : ""}${p.deltaPp} pts)`;
    case "METADATA_EDITED":
      return Object.keys(p.changes ?? {}).join(", ");
    case "ANCHOR":
      return `entries #${p.fromSeq}–#${p.toSeq}`;
    case "ASSET_UPLOADED":
      return p.resourceType === "image" ? "photo" : String(p.resourceType ?? "");
    default:
      return "";
  }
}

/** Technical extras shown in the monospace line. */
function technical(e: Entry): string {
  const p = (e.payload ?? {}) as Record<string, any>;
  if (e.type === "DERIVATIVE_ISSUED" && p.transformation) return ` · ${p.transformation}`;
  if (e.type === "ASSET_UPLOADED" && p.phash) return ` · pHash ${p.phash}`;
  if (e.type === "ANCHOR" && p.root) return ` · root ${short(String(p.root))}`;
  return "";
}

/**
 * Re-verifies the whole ledger in the viewer's browser with Web Crypto:
 * every entry hash, every link, and every published Merkle anchor.
 */
export function ChainVerifier({ assetId, projectId, title = "Tamper-evident ledger" }: { assetId?: string; projectId?: string; title?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [anchors, setAnchors] = useState<{ anchor: AnchorRow; ok: boolean }[]>([]);
  const [result, setResult] = useState<ChainVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Presentational: which kind of entry the full audit trail is showing.
  const [filter, setFilter] = useState<"all" | Group>("all");

  const run = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      // Page through the whole chain (5,000 entries per request)
      const all: Entry[] = [];
      for (let afterSeq = 0; ; ) {
        const ledgerRes = await fetch(`/api/ledger?limit=5000&afterSeq=${afterSeq}`);
        const ledger = await ledgerRes.json();
        if (!ledger.success) throw new Error(ledger.error);
        all.push(...ledger.entries);
        if (ledger.entries.length < 5000) break;
        afterSeq = ledger.entries[ledger.entries.length - 1].seq;
      }
      const anchorJson = await (await fetch("/api/ledger/anchor")).json();

      setResult(await verifyChain(all));
      setEntries(all);

      const checkedAnchors = await Promise.all(
        (anchorJson.anchors ?? []).map(async (a: AnchorRow) => {
          const leaves = all.filter((e) => e.seq >= a.fromSeq && e.seq <= a.toSeq).map((e) => e.entryHash);
          return { anchor: a, ok: leaves.length === a.entryCount && (await merkleRoot(leaves)) === a.root };
        })
      );
      setAnchors(checkedAnchors);
    } catch (err: any) {
      setError(err.message || "Could not load ledger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const shown = entries
    .filter((e) => (assetId ? e.assetId === assetId : projectId ? e.projectId === projectId : true))
    .sort((a, b) => b.seq - a.seq);

  const brokenAnchors = anchors.filter((a) => !a.ok).length;

  // The full audit trail (no single photo) gets the hero status, KPIs and filters.
  const full = !assetId;
  const visible = full && filter !== "all" ? shown.filter((e) => metaFor(e).group === filter) : shown;
  const groupCounts = shown.reduce<Record<string, number>>((acc, e) => {
    const g = metaFor(e).group;
    if (g) acc[g] = (acc[g] ?? 0) + 1;
    return acc;
  }, {});
  const lastSealedSeq = anchors.reduce((max, a) => Math.max(max, a.anchor.toSeq), 0);
  const newSinceSeal = shown.filter((e) => e.seq > lastSealedSeq && e.type !== "ANCHOR").length;
  const latest = shown[0];
  const latestSeal = anchors[0]?.anchor;

  // Group entries by day for the timeline.
  const days: { label: string; items: Entry[] }[] = [];
  for (const e of visible) {
    const label = dayLabel(e.createdAt);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(e);
    else days.push({ label, items: [e] });
  }

  const status = error ? "error" : loading || !result ? "loading" : result.ok ? "ok" : "broken";

  const recheckButton = (variant: "glass" | "secondary") => (
    <button
      type="button"
      id="recompute-chain-btn"
      onClick={run}
      disabled={loading}
      className={cx("btn btn-sm", variant === "glass" ? "btn-glass" : "btn-secondary")}
      title="Recompute every fingerprint in your browser"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      Check again
    </button>
  );

  const timeline = (
    <div className={cx("overflow-y-auto", full ? "max-h-[680px]" : "max-h-[480px]")}>
      {loading && shown.length === 0 ? (
        <div className="space-y-5 px-5 py-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-7 w-7 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <IconChip icon={History} tone="zinc" />
          <p className="text-sm text-zinc-500">{shown.length === 0 ? "No entries yet." : "No entries of this kind."}</p>
        </div>
      ) : (
        days.map((day) => (
          <div key={day.label}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-y border-zinc-100 bg-zinc-50/95 px-5 py-1.5 text-xs font-medium text-zinc-500 backdrop-blur first:border-t-0">
              <span>{day.label}</span>
              <span className="tabular-nums text-zinc-400">{day.items.length}</span>
            </div>
            <ol className="space-y-1 px-3 py-3">
              {day.items.map((e) => {
                const broken = result && !result.ok && result.brokenAtSeq !== null && e.seq >= result.brokenAtSeq;
                const desc = describe(e);
                const meta = metaFor(e);
                return (
                  <li
                    key={e.id}
                    className={cx(
                      // The connector runs from this icon down to the next one in the same day.
                      "relative flex gap-3 rounded-lg px-2 py-2 transition after:absolute after:-bottom-3 after:left-[21.5px] after:top-9 after:w-px after:bg-zinc-200 last:after:hidden",
                      broken ? "bg-red-50 ring-1 ring-inset ring-red-600/15" : "hover:bg-zinc-50"
                    )}
                  >
                    <IconChip icon={broken ? ShieldX : meta.icon} tone={broken ? "red" : meta.tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="min-w-0 text-sm text-zinc-900">
                          <span className="font-medium">{TYPE_LABELS[e.type] ?? e.type}</span>
                          {desc && <span className="text-zinc-500"> · {desc}</span>}
                        </p>
                        <time
                          dateTime={new Date(e.createdAt).toISOString()}
                          title={new Date(e.createdAt).toLocaleString()}
                          className="shrink-0 text-xs tabular-nums text-zinc-400"
                        >
                          {timeAgo(e.createdAt)}
                        </time>
                      </div>
                      <p className="truncate text-xs text-zinc-500">{e.actor}</p>
                      <p
                        className={cx("mt-0.5 truncate font-mono text-[11px]", broken ? "text-red-700" : "text-zinc-400")}
                        title={`Entry ${e.entryHash}\nPrevious ${e.prevHash}`}
                      >
                        <span className="tabular-nums">#{e.seq}</span> · {short(e.entryHash)} ← {short(e.prevHash)}
                        {technical(e)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
    </div>
  );

  const sealList = (
    <ul className="space-y-3">
      {anchors.slice(0, 3).map(({ anchor, ok }) => (
        <li key={anchor.id} className="flex items-start gap-3">
          <span
            className={cx(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}
          >
            {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          <div className="min-w-0 text-xs">
            <p className="text-[13px] font-medium text-zinc-900">
              Entries <span className="tabular-nums">#{anchor.fromSeq}–#{anchor.toSeq}</span>
            </p>
            <p className="text-zinc-500">
              <span title={new Date(anchor.createdAt).toLocaleString()}>{timeAgo(anchor.createdAt)}</span>
              {" · "}
              {ok ? "matches the record" : <span className="text-red-700">no longer matches</span>}
            </p>
            <p className="truncate font-mono text-[11px] text-zinc-400" title={anchor.root}>
              {short(anchor.root)}
            </p>
            {anchor.externalRef && (
              <a
                href={anchor.externalRef}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
              >
                Published copy <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  /* ------------------------------------------------------------------ */
  /* Compact view: one photo's history (used on the public verify page)  */
  /* ------------------------------------------------------------------ */
  if (!full) {
    return (
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <IconChip icon={History} tone="emerald" size="sm" />
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                {title}
                {!loading && shown.length > 0 && (
                  <span className="ml-2 text-sm font-normal tabular-nums text-zinc-400">{shown.length}</span>
                )}
              </h2>
              <p className="text-[13px] text-zinc-500">Everything that happened to this photo, in order.</p>
            </div>
          </div>
          {recheckButton("secondary")}
        </div>

        <div className="px-5 pb-4">
          {status === "error" ? (
            <ErrorNote>{error}</ErrorNote>
          ) : status === "loading" ? (
            <p className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-500 ring-1 ring-inset ring-zinc-900/5">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Checking the record
            </p>
          ) : result!.ok ? (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50/70 px-3.5 py-3 ring-1 ring-inset ring-emerald-600/10">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  All <span className="tabular-nums">{result!.checked}</span> entries intact
                </p>
                <p className="text-[13px] text-emerald-900/60">
                  Every entry was re-checked in your browser. Nothing has been changed since it was written.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 px-3.5 py-3 ring-1 ring-inset ring-red-600/15">
              <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Chain broken at entry <span className="tabular-nums">#{result!.brokenAtSeq}</span>
                </p>
                <p className="text-[13px] text-red-900/70">{result!.reason}</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-100">{timeline}</div>

        {anchors.length > 0 && (
          <details className="group border-t border-zinc-100">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[13px] font-medium text-zinc-700 transition hover:text-zinc-900 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-zinc-400" />
                Seals <span className="font-normal tabular-nums text-zinc-400">{anchors.length}</span>
                {brokenAnchors > 0 ? (
                  <span className="badge badge-red">{brokenAnchors} no longer match</span>
                ) : (
                  <span className="badge badge-green">all match</span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-zinc-100 px-5 py-4">{sealList}</div>
          </details>
        )}
      </section>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Full audit trail                                                     */
  /* ------------------------------------------------------------------ */
  const heroTone =
    status === "ok"
      ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-[0_20px_40px_-20px_rgba(5,150,105,0.6)]"
      : status === "broken" || status === "error"
        ? "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-[0_20px_40px_-20px_rgba(220,38,38,0.6)]"
        : "bg-gradient-to-br from-zinc-50 via-white to-white text-zinc-900 ring-1 ring-zinc-200";

  return (
    <div className="space-y-6">
      {/* Hero status */}
      <div className={cx("relative overflow-hidden rounded-2xl p-6 sm:p-7", heroTone)}>
        <div
          className={cx(
            "pointer-events-none absolute inset-0 [background-size:18px_18px]",
            status === "loading"
              ? "bg-[radial-gradient(rgba(24,24,27,0.06)_1px,transparent_1px)]"
              : "bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)]"
          )}
        />
        {status !== "loading" && (
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        )}
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className={cx(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1",
                status === "loading" ? "bg-white text-emerald-600 shadow-sm ring-zinc-200" : "bg-white/15 ring-white/25"
              )}
            >
              {status === "loading" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : status === "ok" ? (
                <ShieldCheck className="h-7 w-7" />
              ) : (
                <ShieldX className="h-7 w-7" />
              )}
            </span>
            <div className="min-w-0 space-y-1">
              <p className={cx("text-[13px] font-medium", status === "loading" ? "text-zinc-500" : "text-white/75")}>
                Record status
              </p>
              {status === "loading" ? (
                <>
                  <p className="text-xl font-semibold tracking-tight">Checking the record</p>
                  <p className="text-sm text-zinc-500">Recomputing every fingerprint in your browser.</p>
                </>
              ) : status === "error" ? (
                <>
                  <p className="text-xl font-semibold tracking-tight">Couldn&apos;t load the record</p>
                  <p className="text-sm text-red-50/85 [overflow-wrap:anywhere]">{error}</p>
                </>
              ) : status === "ok" ? (
                <>
                  <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                    All <span className="tabular-nums">{result!.checked}</span> entries intact
                  </p>
                  <p className="text-sm text-emerald-50/85">
                    Every entry was re-checked in your browser. Nothing has been changed since it was written.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Chain broken at entry <span className="tabular-nums">#{result!.brokenAtSeq}</span>
                  </p>
                  <p className="text-sm text-red-50/85">{result!.reason}</p>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0">{recheckButton(status === "loading" ? "secondary" : "glass")}</div>
        </div>
      </div>

      {/* KPIs */}
      {status === "loading" && entries.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[104px] rounded-2xl" />
          ))}
        </div>
      ) : status !== "error" ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Entries"
            value={shown.length.toLocaleString()}
            icon={Layers}
            tone="emerald"
            hint={
              projectId && result
                ? `of ${result.checked.toLocaleString()} in the whole record`
                : "Added one by one, never changed"
            }
          />
          <Stat
            label="New since last seal"
            value={newSinceSeal.toLocaleString()}
            icon={Hourglass}
            tone={newSinceSeal > 0 ? "amber" : "emerald"}
            hint={newSinceSeal > 0 ? "Ready to be sealed" : "Everything is sealed"}
          />
          <Stat
            label="Seals"
            value={anchors.length}
            icon={Lock}
            tone={brokenAnchors > 0 ? "red" : "emerald"}
            hint={
              anchors.length === 0
                ? "None yet"
                : brokenAnchors > 0
                  ? `${brokenAnchors} no longer match`
                  : latestSeal
                    ? `Last sealed ${timeAgo(latestSeal.createdAt)}`
                    : "All match"
            }
          />
          <Stat
            label="Last activity"
            value={latest ? timeAgo(latest.createdAt) : "None"}
            icon={Clock}
            tone="sky"
            hint={latest ? TYPE_LABELS[latest.type] ?? latest.type : undefined}
          />
        </div>
      ) : null}

      {/* Timeline + seals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <IconChip icon={History} tone="emerald" size="sm" />
              <div>
                <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                  {title}
                  {!loading && shown.length > 0 && (
                    <span className="ml-2 text-sm font-normal tabular-nums text-zinc-400">{visible.length}</span>
                  )}
                </h2>
                <p className="text-[13px] text-zinc-500">Newest first. Hover a fingerprint for the full value.</p>
              </div>
            </div>
          </div>
          {shown.length > 0 && (
            <div className="px-5 pb-4">
              <Tabs
                value={filter}
                onChange={setFilter}
                items={FILTERS.filter((f) => f.value === "all" || groupCounts[f.value]).map((f) => ({
                  value: f.value,
                  label: f.label,
                  count: f.value === "all" ? shown.length : groupCounts[f.value],
                }))}
              />
            </div>
          )}
          <div className="border-t border-zinc-100">{timeline}</div>
        </section>

        <aside className="space-y-6">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <IconChip icon={Lock} tone={brokenAnchors > 0 ? "red" : "emerald"} size="sm" />
                <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                  Seals
                  {anchors.length > 0 && (
                    <span className="ml-2 text-sm font-normal tabular-nums text-zinc-400">{anchors.length}</span>
                  )}
                </h2>
              </div>
              {anchors.length > 0 &&
                (brokenAnchors > 0 ? (
                  <span className="badge badge-red">{brokenAnchors} no longer match</span>
                ) : (
                  <span className="badge badge-green">
                    <Check className="h-3 w-3" /> All match
                  </span>
                ))}
            </div>
            <div className="border-t border-zinc-100 px-5 py-4">
              {loading && anchors.length === 0 ? (
                <div className="space-y-3">
                  <div className="skeleton h-10 rounded-lg" />
                  <div className="skeleton h-10 rounded-lg" />
                </div>
              ) : anchors.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-zinc-500">
                  No seals yet. Sealing locks in every entry so far with one fingerprint you can publish.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-xs font-medium text-zinc-500">Latest</p>
                  {sealList}
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
