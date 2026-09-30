"use client";

import { useState } from "react";
import { X, RotateCcw, Loader2, Tags, Sparkles } from "lucide-react";
import { ErrorNote, IconChip } from "./ui";

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
  // Most confident first, so the strongest signals are easiest to scan.
  const sorted = [...tags].sort((a, b) => b.confidence - a.confidence);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconChip icon={Tags} tone="violet" size="sm" />
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              Labels
              {tags.length > 0 && <span className="font-normal tabular-nums text-zinc-400">{tags.length}</span>}
            </h3>
            <p className="text-xs text-zinc-500">
              {isPending ? (
                <span className="inline-flex items-center gap-1 text-violet-700">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analyzing
                </span>
              ) : (
                "What the AI sees and how sure it is. Remove any that are wrong."
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          id="reanalyze-asset-btn"
          onClick={handleReanalyze}
          disabled={reanalyzing || isPending}
          className="btn btn-secondary btn-sm shrink-0"
        >
          {reanalyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 text-violet-600" />
          )}
          {reanalyzing ? "Analyzing…" : "Re-analyze"}
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {tags.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-violet-200 bg-violet-50/30 px-4 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm ring-1 ring-violet-100">
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          </span>
          <p className="max-w-xs text-sm text-zinc-500">
            {isPending ? "The AI is analyzing this file." : "No labels yet. Select Re-analyze to try again."}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sorted.map((tag) => {
            const confPct = Math.round(tag.confidence * 100);
            const removing = rejectingId === tag.id;
            return (
              <span
                key={tag.id}
                id={`ai-tag-chip-${tag.id}`}
                className={`inline-flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white py-1 pl-2.5 pr-1 text-[13px] text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-violet-200 hover:bg-violet-50/40 ${
                  removing ? "opacity-60" : ""
                }`}
              >
                <span className="font-medium">{tag.label}</span>
                <span className="flex items-center gap-1.5" title={`How sure the AI is: ${confPct}%`}>
                  <span className="h-1 w-8 overflow-hidden rounded-full bg-violet-100" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.max(0, Math.min(100, confPct))}%` }}
                    />
                  </span>
                  <span className="text-[11px] tabular-nums text-zinc-400">{confPct}%</span>
                </span>
                <button
                  type="button"
                  id={`reject-tag-btn-${tag.id}`}
                  onClick={() => handleRejectTag(tag.id)}
                  disabled={removing}
                  title="Remove this label"
                  aria-label={`Remove label ${tag.label}`}
                  className="rounded-md p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </button>
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
