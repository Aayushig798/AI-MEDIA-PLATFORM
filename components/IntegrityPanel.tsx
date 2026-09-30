"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  ListChecks,
  Loader2,
  Quote,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  UserCheck,
  UserX,
} from "lucide-react";
import { IntegritySummary, VERDICT_LABELS, effectiveVerdict } from "./TrustBadge";
import { CheckList, CheckResultView } from "./CheckList";
import { ErrorNote, IconChip, Ring, cx, type Tone } from "./ui";

interface FullIntegrity extends IntegritySummary {
  checks: CheckResultView[];
  error?: string | null;
  reviewNote?: string | null;
  reviewedBy?: string | null;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const SUMMARY_CLS =
  "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50/80 [&::-webkit-details-marker]:hidden";

const HERO: Record<Tone, string> = {
  emerald: "from-emerald-50 via-white to-white ring-emerald-100",
  amber: "from-amber-50 via-white to-white ring-amber-100",
  red: "from-red-50 via-white to-white ring-red-100",
  zinc: "from-zinc-50 via-white to-white ring-zinc-200",
  sky: "from-sky-50 via-white to-white ring-sky-100",
  violet: "from-violet-50 via-white to-white ring-violet-100",
};

const LABEL_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
  zinc: "text-zinc-900",
  sky: "text-sky-700",
  violet: "text-violet-700",
};

/** Verification panel for the asset viewer: status first, verify, then checks and claim on demand. */
export function IntegrityPanel({
  assetId,
  initial,
  initialClaim,
  onVerified,
}: {
  assetId: string;
  initial?: IntegritySummary | null;
  initialClaim?: string | null;
  onVerified?: (integrity: IntegritySummary) => void;
}) {
  const [integrity, setIntegrity] = useState<FullIntegrity | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [claim, setClaim] = useState(initialClaim ?? "");
  const [savedClaim, setSavedClaim] = useState(initialClaim ?? "");
  const [savingClaim, setSavingClaim] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/assets/${assetId}/integrity`);
    const data = await res.json();
    if (data.success) {
      setIntegrity(data.integrity);
      setClaim(data.claimText ?? "");
      setSavedClaim(data.claimText ?? "");
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async () => {
    try {
      setVerifying(true);
      setError("");
      const res = await fetch(`/api/assets/${assetId}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Verification failed");
      setIntegrity(data.integrity);
      onVerified?.(data.integrity);
    } catch (e: any) {
      setError(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const saveClaim = async () => {
    setSavingClaim(true);
    setError("");
    const res = await fetch(`/api/assets/${assetId}/claim`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimText: claim }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) setError(data.error || "Failed to save claim");
    else {
      setSavedClaim(claim);
      load();
    }
    setSavingClaim(false);
  };

  const shown = integrity ?? initial ?? null;
  const done = integrity?.status === "DONE";
  const checks = done ? integrity.checks ?? [] : [];
  const issues = checks.filter((c) => c.status === "fail" || c.status === "warn").length;

  // Presentational breakdown for the stacked bar.
  const counts = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
    other: checks.filter((c) => c.status === "skipped" || c.status === "error").length,
  };

  const checkedOn = shown?.computedAt ? formatDate(shown.computedAt) : null;
  const running = verifying || shown?.status === "RUNNING";
  const verdict = effectiveVerdict(shown);
  const score = shown?.status === "DONE" && shown.trustScore != null ? shown.trustScore : null;

  const tone: Tone = running
    ? "zinc"
    : verdict === "VERIFIED"
      ? "emerald"
      : verdict === "REVIEW"
        ? "amber"
        : verdict === "FLAGGED"
          ? "red"
          : "zinc";

  const label = running
    ? "Verifying"
    : shown?.status === "ERROR"
      ? "Check failed"
      : !verdict
        ? VERDICT_LABELS.UNVERIFIED
        : shown?.reviewDecision === "APPROVED"
          ? "Approved"
          : shown?.reviewDecision === "REJECTED"
            ? "Rejected"
            : VERDICT_LABELS[verdict];

  const explanation = verifying
    ? "Running checks. This can take a minute."
    : shown?.status === "RUNNING"
      ? "Checks are running."
      : shown?.status === "ERROR"
        ? "The last check did not finish. Try again."
        : !verdict
          ? "Not verified yet. Verifying runs 9 automated checks, such as duplicates, location and weather."
          : shown?.reviewDecision === "APPROVED"
            ? "A reviewer looked at this and approved it as evidence."
            : shown?.reviewDecision === "REJECTED"
              ? "A reviewer looked at this and rejected it as evidence."
              : verdict === "VERIFIED"
                ? "Passed the automatic checks for reuse, editing, place and date."
                : verdict === "FLAGGED"
                  ? "The checks found a problem. Don't rely on it without a closer look."
                  : "Some checks couldn't confirm it, so a person should take a look.";

  const statusLine =
    shown?.status === "DONE" ? (checkedOn ? `Last checked ${checkedOn}` : "Checks complete") : null;

  return (
    <section className="space-y-3">
      {/* Verdict hero */}
      <div className={cx("relative overflow-hidden rounded-2xl bg-gradient-to-br ring-1 ring-inset", HERO[tone])}>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(rgba(24,24,27,0.07)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex items-center gap-4 p-4">
          {score != null && !running ? (
            <Ring value={score} size={76} stroke={7} tone={tone}>
              <span className="flex flex-col items-center leading-none">
                <span className="text-[22px] font-semibold tabular-nums tracking-tight text-zinc-900">{score}</span>
                <span className="mt-1 text-[10px] font-medium text-zinc-400">of 100</span>
              </span>
            </Ring>
          ) : (
            // No score yet: an empty track instead of a zero-length arc.
            <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-[7px] border-zinc-100 bg-white/60">
              {running ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              ) : (
                <ShieldQuestion className="h-6 w-6 text-zinc-300" />
              )}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-xs font-medium text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              {score != null ? "Trust score" : "Verification"}
            </p>
            <p className={cx("mt-0.5 text-lg font-semibold leading-tight tracking-tight", LABEL_TEXT[tone])}>{label}</p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-600">{explanation}</p>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900/5 bg-white/60 px-4 py-2.5">
          <p className="text-xs text-zinc-500">{statusLine ?? "Results appear here after checking."}</p>
          <div className="flex items-center gap-1">
            <Link
              href={`/verify/${assetId}`}
              target="_blank"
              className="btn btn-ghost btn-sm"
              title="Open the public verification page"
            >
              Public page
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              id="verify-asset-btn"
              onClick={verify}
              disabled={verifying}
              className={cx("btn btn-sm shrink-0", done ? "btn-secondary" : "btn-primary")}
            >
              {verifying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : done ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              {verifying ? "Checking…" : done ? "Check again" : "Verify"}
            </button>
          </div>
        </div>
      </div>

      {/* Supporting detail */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {integrity?.reviewDecision && (
          <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-3">
            <IconChip
              icon={integrity.reviewDecision === "APPROVED" ? UserCheck : UserX}
              tone={integrity.reviewDecision === "APPROVED" ? "emerald" : "red"}
              size="sm"
            />
            <p className="min-w-0 pt-1 text-[13px] leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-900">
                {integrity.reviewDecision === "APPROVED" ? "Approved" : "Rejected"}
              </span>{" "}
              by {integrity.reviewedBy || "a reviewer"}
              {integrity.reviewNote ? `: “${integrity.reviewNote}”` : ""}
            </p>
          </div>
        )}

        {checks.length > 0 && (
          <details className="group border-b border-zinc-100">
            <summary className={SUMMARY_CLS}>
              <span className="flex min-w-0 items-center gap-3">
                <IconChip icon={ListChecks} tone={counts.fail > 0 ? "red" : issues > 0 ? "amber" : "emerald"} size="sm" />
                <span>Check results</span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5 text-xs font-normal">
                <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 sm:flex" aria-hidden>
                  <span className="h-full bg-emerald-500" style={{ width: `${(counts.pass / checks.length) * 100}%` }} />
                  <span className="h-full bg-amber-500" style={{ width: `${(counts.warn / checks.length) * 100}%` }} />
                  <span className="h-full bg-red-500" style={{ width: `${(counts.fail / checks.length) * 100}%` }} />
                  <span className="h-full bg-zinc-300" style={{ width: `${(counts.other / checks.length) * 100}%` }} />
                </span>
                {issues > 0 ? (
                  <span className="font-medium text-amber-700">{issues} to review</span>
                ) : (
                  <span className="tabular-nums text-zinc-500">
                    {counts.pass} of {checks.length} passed
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t border-zinc-100 px-4 pb-2 pt-3">
              <CheckList checks={checks} compact />
            </div>
          </details>
        )}

        <details className="group">
          <summary className={SUMMARY_CLS}>
            <span className="flex shrink-0 items-center gap-3">
              <IconChip icon={Quote} tone="zinc" size="sm" />
              <span>Claim</span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-xs font-normal text-zinc-400">
              <span className="max-w-[180px] truncate">{savedClaim || "Uses the project claim"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="space-y-2.5 border-t border-zinc-100 px-4 py-3.5">
            <p className="text-xs leading-relaxed text-zinc-500">
              What this photo should show. The AI checks the photo against it. Leave blank to use the project claim.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                placeholder="e.g. 200 saplings planted along the river bank"
                className="input min-w-0 flex-1"
              />
              {claim !== savedClaim && (
                <button type="button" onClick={saveClaim} disabled={savingClaim} className="btn btn-dark shrink-0">
                  {savingClaim && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </button>
              )}
            </div>
          </div>
        </details>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {integrity?.status === "ERROR" && integrity.error && (
        <details className="group rounded-lg bg-red-50 text-sm text-red-700 ring-1 ring-inset ring-red-600/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
            What went wrong
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <p className="break-words border-t border-red-600/10 px-3 py-2 text-[13px]">{integrity.error}</p>
        </details>
      )}
    </section>
  );
}
