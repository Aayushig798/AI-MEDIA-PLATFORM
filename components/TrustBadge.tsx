import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Loader2, UserCheck, UserX } from "lucide-react";

export interface IntegritySummary {
  status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  trustScore: number | null;
  verdict: "VERIFIED" | "REVIEW" | "FLAGGED" | null;
  reviewDecision?: "APPROVED" | "REJECTED" | null;
  computedAt?: string | null;
}

const STYLES = {
  VERIFIED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  REVIEW: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  FLAGGED: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  NEUTRAL: "bg-slate-800/80 text-slate-300 border-white/10",
};

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
      ? "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border"
      : "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-md";
  const icon = size === "lg" ? "w-4 h-4" : "w-3 h-3";

  if (!integrity || integrity.status === "PENDING") {
    return (
      <span className={`${base} ${STYLES.NEUTRAL}`} title="Not verified yet">
        <ShieldQuestion className={icon} /> Unverified
      </span>
    );
  }
  if (integrity.status === "RUNNING") {
    return (
      <span className={`${base} ${STYLES.NEUTRAL}`}>
        <Loader2 className={`${icon} animate-spin`} /> Verifying
      </span>
    );
  }
  if (integrity.status === "ERROR") {
    return (
      <span className={`${base} ${STYLES.NEUTRAL}`} title="Verification failed; retry">
        <ShieldQuestion className={icon} /> Retry
      </span>
    );
  }

  const verdict = effectiveVerdict(integrity) ?? "REVIEW";
  const Icon =
    integrity.reviewDecision === "APPROVED"
      ? UserCheck
      : integrity.reviewDecision === "REJECTED"
        ? UserX
        : verdict === "VERIFIED"
          ? ShieldCheck
          : verdict === "FLAGGED"
            ? ShieldX
            : ShieldAlert;
  const label = integrity.reviewDecision
    ? integrity.reviewDecision === "APPROVED"
      ? "Approved"
      : "Rejected"
    : verdict === "VERIFIED"
      ? "Verified"
      : verdict === "FLAGGED"
        ? "Flagged"
        : "Review";

  return (
    <span
      className={`${base} ${STYLES[verdict]}`}
      title={`Trust Score ${integrity.trustScore}/100${integrity.reviewDecision ? ` · human ${integrity.reviewDecision.toLowerCase()}` : ""}`}
    >
      <Icon className={icon} />
      {label} · {integrity.trustScore}
    </span>
  );
}
