import { Loader2 } from "lucide-react";

export interface IntegritySummary {
  status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  trustScore: number | null;
  verdict: "VERIFIED" | "REVIEW" | "FLAGGED" | null;
  reviewDecision?: "APPROVED" | "REJECTED" | null;
  computedAt?: string | null;
}

const DOT = {
  VERIFIED: "bg-emerald-500",
  REVIEW: "bg-amber-500",
  FLAGGED: "bg-red-500",
  NEUTRAL: "bg-zinc-400",
};

const TONE = {
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  REVIEW: "bg-amber-50 text-amber-700 ring-amber-600/15",
  FLAGGED: "bg-red-50 text-red-700 ring-red-600/15",
  NEUTRAL: "bg-zinc-50 text-zinc-600 ring-zinc-500/15",
};

export const VERDICT_LABELS = {
  VERIFIED: "Verified",
  REVIEW: "Needs review",
  FLAGGED: "Flagged",
  UNVERIFIED: "Unverified",
} as const;

/** Human decision overrides the machine verdict for display (the machine score stays visible). */
export function effectiveVerdict(i: IntegritySummary | null | undefined): "VERIFIED" | "REVIEW" | "FLAGGED" | null {
  if (!i || i.status !== "DONE") return null;
  if (i.reviewDecision === "APPROVED") return "VERIFIED";
  if (i.reviewDecision === "REJECTED") return "FLAGGED";
  return i.verdict;
}

export function TrustBadge({
  integrity,
  size = "sm",
}: {
  integrity: IntegritySummary | null | undefined;
  size?: "sm" | "lg";
}) {
  const base =
    size === "lg"
      ? "inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-sm font-medium ring-1 ring-inset"
      : "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset";
  const dot = size === "lg" ? "h-2 w-2 rounded-full" : "h-1.5 w-1.5 rounded-full";

  if (!integrity || integrity.status === "PENDING") {
    return (
      <span className={`${base} ${TONE.NEUTRAL}`} title="Not verified yet">
        <span className={`${dot} ${DOT.NEUTRAL}`} /> Unverified
      </span>
    );
  }
  if (integrity.status === "RUNNING") {
    return (
      <span className={`${base} ${TONE.NEUTRAL}`}>
        <Loader2 className={size === "lg" ? "h-3.5 w-3.5 animate-spin" : "h-3 w-3 animate-spin"} /> Verifying
      </span>
    );
  }
  if (integrity.status === "ERROR") {
    return (
      <span className={`${base} ${TONE.NEUTRAL}`} title="Verification failed; try again">
        <span className={`${dot} ${DOT.NEUTRAL}`} /> Check failed
      </span>
    );
  }

  const verdict = effectiveVerdict(integrity) ?? "REVIEW";
  const label = integrity.reviewDecision
    ? integrity.reviewDecision === "APPROVED"
      ? "Approved"
      : "Rejected"
    : VERDICT_LABELS[verdict];

  return (
    <span
      className={`${base} ${TONE[verdict]}`}
      title={`Trust score ${integrity.trustScore}/100${integrity.reviewDecision ? ` · ${integrity.reviewDecision.toLowerCase()} by a reviewer` : ""}`}
    >
      <span className={`${dot} ${DOT[verdict]}`} />
      {label}
      {size === "lg" && integrity.trustScore != null && (
        <span className="font-normal tabular-nums opacity-70">{integrity.trustScore}/100</span>
      )}
    </span>
  );
}
