"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  Sparkles,
  Cpu,
  Layers,
  FileText,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

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

export function TraceabilityTimeline({ assetId }: TraceabilityTimelineProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/assets/${assetId}/audit-log`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
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

  const getEventConfig = (eventType: string) => {
    switch (eventType) {
      case "uploaded":
        return {
          icon: <Upload className="w-3.5 h-3.5 text-emerald-400" />,
          title: "Asset Uploaded & Registered",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          nodeBg: "bg-emerald-950 border-emerald-500/40",
        };
      case "ai_tagged":
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-violet-400" />,
          title: "AI Visual Tagging & Categorization",
          badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/30",
          nodeBg: "bg-violet-950 border-violet-500/40",
        };
      case "embedded":
        return {
          icon: <Cpu className="w-3.5 h-3.5 text-cyan-400" />,
          title: "Vector Embedding Generated",
          badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
          nodeBg: "bg-cyan-950 border-cyan-500/40",
        };
      case "used_in_comparison":
        return {
          icon: <Layers className="w-3.5 h-3.5 text-amber-400" />,
          title: "Linked in Before/After Comparison",
          badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          nodeBg: "bg-amber-950 border-amber-500/40",
        };
      case "used_in_report":
        return {
          icon: <FileText className="w-3.5 h-3.5 text-rose-400" />,
          title: "Included in Stakeholder Impact Report",
          badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          nodeBg: "bg-rose-950 border-rose-500/40",
        };
      default:
        return {
          icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
          title: eventType.replace(/_/g, " "),
          badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/30",
          nodeBg: "bg-slate-900 border-slate-600",
        };
    }
  };

  const renderEventDetails = (log: AuditLogItem) => {
    const detail = log.eventDetail || {};

    if (log.eventType === "uploaded") {
      return (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {detail.format && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
              .{detail.format}
            </span>
          )}
          {detail.bytes && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
              {(detail.bytes / 1024).toFixed(0)} KB
            </span>
          )}
          {detail.resourceType && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 capitalize">
              {detail.resourceType}
            </span>
          )}
        </div>
      );
    }

    if (log.eventType === "ai_tagged") {
      const tags: string[] = detail.tags || [];
      const primaryCat = detail.primaryCategory;
      return (
        <div className="space-y-1.5 mt-2">
          {primaryCat && (
            <div className="text-[11px] text-violet-300 flex items-center gap-1 font-medium">
              <span className="text-slate-400">Primary Domain:</span>
              <span className="px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-200">
                {primaryCat}
              </span>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 6).map((t: string, i: number) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-violet-950/60 text-violet-300 border border-violet-800/40"
                >
                  {t}
                </span>
              ))}
              {tags.length > 6 && (
                <span className="text-[10px] text-slate-500 self-center">
                  +{tags.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    if (log.eventType === "embedded") {
      return (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 font-mono">
            {detail.model || "text-embedding-3-small"}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
            {detail.dimensions || 1536}-dim pgvector
          </span>
        </div>
      );
    }

    if (log.eventType === "used_in_comparison") {
      return (
        <div className="space-y-1 mt-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Role in Pair:</span>
            <span className="font-semibold text-amber-300 uppercase text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20">
              {detail.role || "participant"}
            </span>
            {detail.verified !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded ${
                  detail.verified
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {detail.verified ? "✓ Verified Match" : "Unverified"}
              </span>
            )}
          </div>
          {detail.comparisonId && (
            <div className="text-[10px] text-slate-500 font-mono truncate">
              ID: {detail.comparisonId}
            </div>
          )}
        </div>
      );
    }

    if (log.eventType === "used_in_report") {
      return (
        <div className="space-y-1 mt-2 text-[11px]">
          <div className="text-rose-200 font-medium">
            {detail.reportTitle || "Sustainability Impact Report"}
          </div>
          {detail.reportId && (
            <div className="text-[10px] text-slate-500 font-mono truncate">
              Report ID: {detail.reportId}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Traceability Audit Timeline
          </h4>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          title="Refresh audit trail"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Loading immutable audit trail...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500">
          No audit entries recorded for this asset yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-emerald-500/40 before:via-violet-500/40 before:to-rose-500/40">
          {logs.map((log) => {
            const config = getEventConfig(log.eventType);
            const dateStr = new Date(log.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={log.id} className="relative group">
                {/* Node icon */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center shadow-lg ${config.nodeBg}`}
                >
                  {config.icon}
                </div>

                {/* Event body */}
                <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 hover:border-white/15 transition">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {config.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {dateStr}
                    </span>
                  </div>

                  {renderEventDetails(log)}

                  <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Actor:</span>
                      <strong className="text-slate-300 font-medium font-mono">
                        {log.actor}
                      </strong>
                    </span>
                    <span className="font-mono text-[9px] text-slate-600">
                      #{log.id.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
