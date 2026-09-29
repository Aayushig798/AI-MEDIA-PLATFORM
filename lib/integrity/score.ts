import type { Verdict } from "@prisma/client";
import type { CheckResult } from "./types";

export const VERIFIED_THRESHOLD = 75;
export const REVIEW_THRESHOLD = 45;

/**
 * Transparent scoring: start at 100 and subtract each check's penalty.
 * The weights live next to each check so a reviewer can see exactly why.
 */
export function scoreChecks(checks: CheckResult[]): { trustScore: number; verdict: Verdict } {
  const deducted = checks.reduce((sum, c) => sum + (c.penalty || 0), 0);
  const trustScore = Math.max(0, Math.min(100, 100 - deducted));
  const verdict: Verdict =
    trustScore >= VERIFIED_THRESHOLD ? "VERIFIED" : trustScore >= REVIEW_THRESHOLD ? "REVIEW" : "FLAGGED";
  return { trustScore, verdict };
}
