"use client";

import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Modal } from "./ui";

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
  return (
    <Modal
      open={isOpen}
      onClose={saving ? () => {} : onCancel}
      icon={AlertTriangle}
      tone="amber"
      title="Save this comparison anyway?"
      description="These photos may not be a good before-and-after pair."
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            id="confirm-save-anyway-btn"
            className="btn btn-primary btn-sm"
            onClick={onConfirmSaveAnyway}
            disabled={saving}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save anyway
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-50/40 px-4 py-3 ring-1 ring-inset ring-amber-600/15">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-[13px] font-semibold text-amber-900">Why we&apos;re asking</p>
            <p className="text-sm leading-relaxed text-amber-800">
              {reason || "These photos don't appear to show the same place, or they were taken too close together."}
            </p>
          </div>
        </div>
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
          If you save anyway, the comparison will be marked as unverified.
        </p>
      </div>
    </Modal>
  );
}
