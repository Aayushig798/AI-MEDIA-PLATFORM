"use client";

import { useState } from "react";
import { Sparkles, X, RotateCcw, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";

export interface AiTagItem {
  id: string;
  mediaAssetId: string;
  label: string;
  confidence: number;
  source: string;
  createdAt?: string;
}

interface AiTagChipsProps {
  assetId: string;
  tags: AiTagItem[];
  processingStatus: string;
  onTagDeleted: (tagId: string) => void;
  onReanalyzed: (updatedTags: AiTagItem[], newStatus: string) => void;
}

export function AiTagChips({
  assetId,
  tags,
  processingStatus,
  onTagDeleted,
  onReanalyzed,
}: AiTagChipsProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState("");

  const handleRejectTag = async (tagId: string) => {
    try {
      setRejectingId(tagId);
      setError("");

      const res = await fetch(`/api/assets/${assetId}/ai-tags/${tagId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject AI tag");
      }

      onTagDeleted(tagId);
    } catch (err: any) {
      setError(err.message || "Failed to reject tag");
    } finally {
      setRejectingId(null);
    }
  };

  const handleReanalyze = async () => {
    try {
      setReanalyzing(true);
      setError("");

      const res = await fetch(`/api/assets/${assetId}/analyze`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to re-analyze asset");
      }

      onReanalyzed(data.aiTags || [], data.asset?.aiProcessingStatus || "done");
    } catch (err: any) {
      setError(err.message || "Re-analysis failed");
    } finally {
      setReanalyzing(false);
    }
  };

  const isPending = processingStatus === "pending" || processingStatus === "processing";

  return (
    <div className="space-y-3">
      {/* Header with Re-analyze button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">
            AI Detected Labels ({tags.length})
          </span>
          {isPending && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
            </span>
          )}
        </div>

        <button
          type="button"
          id="reanalyze-asset-btn"
          onClick={handleReanalyze}
          disabled={reanalyzing || isPending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition disabled:opacity-50"
        >
          {reanalyzing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3 text-emerald-400" />
          )}
          <span>{reanalyzing ? "Classifying..." : "Re-analyze"}</span>
        </button>
      </div>

      {error && (
        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Tags Chips Stream */}
      {tags.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-center text-xs text-slate-400">
          {isPending
            ? "AI classification is actively analyzing objects and scenes in this asset..."
            : "No AI tags assigned yet. Click 'Re-analyze' to trigger classification."}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const confPct = Math.round(tag.confidence * 100);
            return (
              <span
                key={tag.id}
                id={`ai-tag-chip-${tag.id}`}
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs bg-slate-900/90 border border-emerald-500/25 text-slate-200 hover:border-emerald-500/50 transition-all shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="font-medium text-slate-100">{tag.label}</span>
                <span className="text-[10px] font-bold text-emerald-400/90 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                  {confPct}%
                </span>
                <button
                  type="button"
                  id={`reject-tag-btn-${tag.id}`}
                  onClick={() => handleRejectTag(tag.id)}
                  disabled={rejectingId === tag.id}
                  title="Reject and remove this tag"
                  className="ml-0.5 p-0.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  {rejectingId === tag.id ? (
                    <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
