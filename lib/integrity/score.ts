import type { Verdict } from "@prisma/client";
import type { CheckResult } from "./types";

export const VERIFIED_THRESHOLD = 75;
export const REVIEW_THRESHOLD = 45;
/** A photo can't be VERIFIED on the strength of fewer checks than this. */
export const MIN_EVIDENCE_CHECKS = 3;

/**
 * Transparent scoring: start at 100 and subtract each check's penalty.
 * The weights live next to each check so a reviewer can see exactly why.
 * Skipped checks cost nothing, so with too little evidence the verdict is
 * capped at REVIEW rather than trusting an unexamined photo.
 */
export function scoreChecks(checks: CheckResult[]): {
  trustScore: number;
  verdict: Verdict;
  evidenceChecks: number;
  capped: boolean;
} {
  const deducted = checks.reduce((sum, c) => sum + (c.penalty || 0), 0);
  const trustScore = Math.max(0, Math.min(100, 100 - deducted));
  const evidenceChecks = checks.filter((c) => c.status === "pass" || c.status === "warn" || c.status === "fail").length;
  let verdict: Verdict =
    trustScore >= VERIFIED_THRESHOLD ? "VERIFIED" : trustScore >= REVIEW_THRESHOLD ? "REVIEW" : "FLAGGED";
  const capped = verdict === "VERIFIED" && evidenceChecks < MIN_EVIDENCE_CHECKS;
  if (capped) verdict = "REVIEW";
  return { trustScore, verdict, evidenceChecks, capped };
}
