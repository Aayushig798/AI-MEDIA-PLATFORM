"use client";

import React from "react";
import { AlertTriangle, X, ShieldAlert, Loader2 } from "lucide-react";

interface ComparisonWarningModalProps {
  isOpen: boolean;
  reason: string;
  onConfirmSaveAnyway: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function ComparisonWarningModal({
  isOpen,
  reason,
  onConfirmSaveAnyway,
  onCancel,
  saving = false,
}: ComparisonWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="glass-dropdown w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl relative border border-amber-500/30 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Pair Verification Warning
              </h3>
              <p className="text-xs text-amber-300/80">
                Visual or temporal match criteria not met
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Reason Box */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300 block mb-1">
              Why this pair may be invalid:
            </span>
            <span>{reason || "These photos do not look like the same scene or have insufficient date separation."}</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          If you proceed with <strong className="text-slate-200">&ldquo;Save anyway&rdquo;</strong>, this evidence pair will be stored as <strong className="text-amber-400">&ldquo;Unverified&rdquo;</strong> in your project evidence archive.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-save-anyway-btn"
            onClick={onConfirmSaveAnyway}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>Save anyway</span>
          </button>
        </div>
      </div>
    </div>
  );
}
