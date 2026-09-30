"use client";

import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import {
  Upload,
  Sparkles,
  Search,
  Layers,
  FileText,
  Clock,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Ruler,
  Clapperboard,
  Link2,
  Pencil,
  History,
  Braces,
  Bot,
  User,
} from "lucide-react";
import { VERDICT_LABELS } from "./TrustBadge";
import { IconChip, SectionHeader, ErrorNote, cx, type Tone } from "./ui";

export interface AuditLogItem {
  id: string;
  mediaAssetId: string;
  eventType: "uploaded" | "ai_tagged" | "embedded" | "used_in_comparison" | "used_in_report" | string;
  eventDetail: any;
  actor: string;
  createdAt: string;
}

interface TraceabilityTimelineProps {
  assetId: string;
}

type IconType = ComponentType<{ className?: string }>;

function sentenceCase(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "3 hours ago" for the last week, a plain date after that. */
function relativeTime(value: string): string {
  const d = new Date(value);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return "";
  const diff = (ms - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (abs < 60) return "Just now";
  if (abs < 3600) return cap(rtf.format(Math.round(diff / 60), "minute"));
  if (abs < 86400) return cap(rtf.format(Math.round(diff / 3600), "hour"));
  if (abs < 86400 * 7) return cap(rtf.format(Math.round(diff / 86400), "day"));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function TraceabilityTimeline({ assetId }: TraceabilityTimelineProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<{ chainIntact: boolean; entries: number } | null>(null);
  const [showTech, setShowTech] = useState(false);

  const fetchLogs = async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/assets/${assetId}/audit-log`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setLedger(data.ledger ?? null);
      } else {
        setError(data.error || "Failed to load audit history");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to audit service");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [assetId]);

  const getEventConfig = (log: AuditLogItem): { icon: IconType; tone: Tone; title: string } => {
    const detail = log.eventDetail || {};
    switch (log.eventType) {
      case "uploaded":
        return { icon: Upload, tone: "emerald", title: "Uploaded" };
      case "ai_tagged":
        return { icon: Sparkles, tone: "violet", title: "Labelled by AI" };
      case "embedded":
        return { icon: Search, tone: "violet", title: "Made searchable" };
      case "used_in_comparison":
        return { icon: Layers, tone: "sky", title: "Used in a before/after comparison" };
      case "used_in_report":
        return { icon: FileText, tone: "emerald", title: "Included in a report" };
      case "integrity_checked": {
        const v = String(detail.verdict);
        return {
          icon: v === "VERIFIED" ? ShieldCheck : ShieldAlert,
          tone: v === "VERIFIED" ? "emerald" : v === "FLAGGED" ? "red" : v === "REVIEW" ? "amber" : "zinc",
          title: "Verification run",
        };
      }
      case "review_decision": {
        const rejected = String(detail.decision).toUpperCase() === "REJECTED";
        return { icon: rejected ? UserX : UserCheck, tone: rejected ? "red" : "emerald", title: "Reviewed" };
      }
      case "derivative_issued":
        return {
          icon: Link2,
          tone: detail.class === "TRANSCODED" ? "zinc" : "amber",
          title: "New version created",
        };
      case "metric_measured":
        return { icon: Ruler, tone: "sky", title: "Change measured" };
      case "reel_rendered":
        return { icon: Clapperboard, tone: "violet", title: "Used in a video reel" };
      case "metadata_edited":
        return { icon: Pencil, tone: "zinc", title: "Details edited" };
      default:
        return { icon: Clock, tone: "zinc", title: sentenceCase(log.eventType) };
    }
  };

  /** Main plain-language line(s) for an event. */
  const renderEventDetails = (log: AuditLogItem): ReactNode => {
    const detail = log.eventDetail || {};

    if (log.eventType === "integrity_checked") {
      const verdict =
        VERDICT_LABELS[String(detail.verdict) as keyof typeof VERDICT_LABELS] ?? String(detail.verdict).toLowerCase();
      return (
        <>
          {verdict} · trust score <span className="tabular-nums">{detail.trustScore}/100</span>
        </>
      );
    }
    if (log.eventType === "review_decision") {
      const decision = String(detail.decision).toLowerCase();
      return (
        <>
          {sentenceCase(decision)}
          {detail.note ? `: “${detail.note}”` : ""}
        </>
      );
    }
    if (log.eventType === "derivative_issued") {
      return detail.class === "TRANSCODED" ? (
        "Format change only, still valid as evidence"
      ) : (
        <span className="text-amber-700">Edited version, for illustration only</span>
      );
    }
    if (log.eventType === "metric_measured") {
      return (
        <span className="tabular-nums">
          {detail.metric === "GREEN_COVER" ? "Green cover" : "Water area"} {detail.beforePct}% → {detail.afterPct}% (
          {detail.deltaPp > 0 ? "+" : ""}
          {detail.deltaPp} points)
        </span>
      );
    }
    if (log.eventType === "metadata_edited") {
      return `Changed: ${Object.keys(detail.changes ?? {}).join(", ")}`;
    }
    if (log.eventType === "reel_rendered") {
      return `${detail.aspect} reel`;
    }
    if (log.eventType === "uploaded") {
      const parts = [
        detail.format ? String(detail.format).toUpperCase() : null,
        detail.bytes ? `${(detail.bytes / 1024).toFixed(0)} KB` : null,
        detail.resourceType ? sentenceCase(String(detail.resourceType)) : null,
      ].filter(Boolean);
      return parts.length ? parts.join(" · ") : null;
    }
    if (log.eventType === "ai_tagged") {
      const tags: string[] = detail.tags || [];
      const primaryCat = detail.primaryCategory;
      if (!primaryCat && tags.length === 0) return null;
      return (
        <div className="space-y-1.5">
          {primaryCat && <p>Category: {primaryCat}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 6).map((t, i) => (
                <span key={`${i}-${t}`} className="badge badge-violet font-normal">
                  {t}
                </span>
              ))}
              {tags.length > 6 && <span className="badge badge-neutral font-normal">+{tags.length - 6} more</span>}
            </div>
          )}
        </div>
      );
    }
    if (log.eventType === "used_in_comparison") {
      return (
        <>
          As the {detail.role || "participant"} photo
          {detail.verified !== undefined && (detail.verified ? " · match verified" : " · match not verified")}
        </>
      );
    }
    if (log.eventType === "used_in_report") {
      return detail.reportTitle || "Sustainability Impact Report";
    }
    return null;
  };

  /** Technical extras (hashes, IDs, model names), shown only on request. */
  const renderTechDetails = (log: AuditLogItem): string[] => {
    const detail = log.eventDetail || {};
    const lines: string[] = [];
    if (log.eventType === "derivative_issued" && detail.transformation) lines.push(`Transformation: ${detail.transformation}`);
    if (log.eventType === "embedded") {
      lines.push(`Model: ${detail.model || "text-embedding-3-small"}`);
      lines.push(`${detail.dimensions || 1536} dimensions`);
    }
    if (log.eventType === "used_in_comparison" && detail.comparisonId) lines.push(`Comparison ID: ${detail.comparisonId}`);
    if (log.eventType === "used_in_report" && detail.reportId) lines.push(`Report ID: ${detail.reportId}`);
    if (detail.ledgerSeq) lines.push(`Ledger #${detail.ledgerSeq} · ${String(detail.entryHash).slice(0, 12)}…`);
    lines.push(`Event #${log.id.slice(-6)}`);
    return lines;
  };

  return (
    <section className="space-y-5">
      <SectionHeader
        title="History"
        description={
          logs.length > 0
            ? `${logs.length} ${logs.length === 1 ? "event" : "events"} recorded for this file`
            : "Everything that has happened to this file."
        }
        icon={History}
        tone="sky"
        actions={
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn btn-ghost btn-sm btn-icon shrink-0"
            title="Refresh history"
            aria-label="Refresh history"
          >
            <RefreshCw className={cx("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        }
      />

      {ledger && (
        <div
          className={cx(
            "flex items-center gap-3 rounded-xl bg-gradient-to-br px-3.5 py-3 ring-1 ring-inset",
            ledger.chainIntact
              ? "from-emerald-50 via-white to-white ring-emerald-100"
              : "from-red-50 via-white to-white ring-red-100",
          )}
          title="Every event is written to a tamper-evident log, so later changes can be detected."
        >
          <IconChip icon={ledger.chainIntact ? ShieldCheck : ShieldAlert} tone={ledger.chainIntact ? "emerald" : "red"} />
          <div className="min-w-0">
            <p className={cx("text-sm font-semibold", ledger.chainIntact ? "text-emerald-800" : "text-red-800")}>
              {ledger.chainIntact ? "Record intact" : "Record altered"}
            </p>
            <p className="text-xs text-zinc-500">
              {ledger.chainIntact
                ? "Every event is written to a tamper-evident log, and none has been changed since."
                : "Some logged events no longer match what was written. Treat this history with care."}
              {ledger.entries > 0 && (
                <span className="tabular-nums">
                  {" "}
                  {ledger.entries} {ledger.entries === 1 ? "entry" : "entries"} for this file.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div className="space-y-5" aria-label="Loading history">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-7 w-7 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-3.5 w-2/5 rounded" />
                <div className="skeleton h-3 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm ring-1 ring-zinc-200">
            <History className="h-5 w-5" />
          </span>
          <p className="text-sm text-zinc-500">No history recorded for this file yet.</p>
        </div>
      ) : (
        <>
          <ol className="relative space-y-1 before:absolute before:bottom-6 before:left-[13.5px] before:top-4 before:w-px before:bg-zinc-200">
            {logs.map((log) => {
              const config = getEventConfig(log);
              const body = renderEventDetails(log);
              const dateStr = new Date(log.createdAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const automatic = !log.actor || log.actor === "system";

              return (
                <li key={log.id} className="relative flex gap-3 pb-4">
                  <span className="relative z-[1] rounded-md ring-4 ring-white">
                    <IconChip icon={config.icon} tone={config.tone} size="sm" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-900">{config.title}</p>
                      <time
                        dateTime={log.createdAt}
                        title={dateStr}
                        className="shrink-0 text-xs tabular-nums text-zinc-400"
                      >
                        {relativeTime(log.createdAt)}
                      </time>
                    </div>
                    {body && <div className="mt-0.5 break-words text-[13px] leading-relaxed text-zinc-600">{body}</div>}
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-400">
                      {automatic ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {automatic ? "Automatic" : log.actor}
                    </p>
                    {showTech && (
                      <div className="mt-2 space-y-0.5 rounded-lg bg-zinc-50 px-2.5 py-2 font-mono text-[11px] text-zinc-500 ring-1 ring-inset ring-zinc-200/70">
                        <p className="break-all">{dateStr}</p>
                        {renderTechDetails(log).map((line) => (
                          <p key={line} className="break-all" title={line.startsWith("Ledger") ? log.eventDetail?.entryHash : undefined}>
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={() => setShowTech((v) => !v)} className="btn btn-ghost btn-sm -ml-2 text-zinc-500">
            <Braces className="h-3.5 w-3.5" />
            {showTech ? "Hide technical details" : "Show technical details"}
          </button>
        </>
      )}
    </section>
  );
}
