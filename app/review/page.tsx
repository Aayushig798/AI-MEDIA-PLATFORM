"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  X,
  ExternalLink,
  ChevronDown,
  Inbox,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Globe,
  CheckCircle2,
  CalendarDays,
  FolderKanban,
  History,
  Loader2,
} from "lucide-react";
import { TrustBadge } from "@/components/TrustBadge";
import { CheckList, CheckResultView } from "@/components/CheckList";
import { getThumbnailUrl, withTransformation } from "@/lib/cloudinary-url";
import { PageHeader, Stat, cx } from "@/components/ui";

interface QueueItem {
  id: string;
  secureUrl: string;
  resourceType: string;
  manualNotes: string | null;
  capturedAt: string | null;
  project: { id: string; name: string };
  integrity: { status: any; trustScore: number; verdict: any; reviewDecision: any; checks: CheckResultView[] };
  phashMatches: { id: string; hamming: number; crossProject: boolean; match: { id: string; secureUrl: string; resourceType: string; project: { name: string } } | null }[];
  webMatches: { id: string; url: string; kind: string; pageTitle: string | null }[];
}

/** One plain sentence explaining why this photo is in the queue. */
function reviewReason(item: QueueItem): string {
  const checks = item.integrity.checks ?? [];
  const issue = checks.find((c) => c.status === "fail") ?? checks.find((c) => c.status === "warn");
  if (issue?.summary) return issue.summary;
  const match = item.phashMatches[0]?.match;
  if (match) return `It looks almost identical to a photo in ${match.project.name}.`;
  if (item.webMatches.length > 0) return "The same image was found elsewhere on the web.";
  return "The automatic checks could not confirm this photo.";
}

function takenLabel(capturedAt: string | null) {
  if (!capturedAt) return null;
  return new Date(capturedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ReviewQueue() {
  const projectId = useSearchParams().get("projectId");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // Presentational: how many decisions were made on this visit (for the "all caught up" message).
  const [decidedCount, setDecidedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/review-queue${projectId ? `?projectId=${projectId}` : ""}`);
    const data = await res.json();
    if (data.success) setItems(data.assets);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setBusy(id);
    const res = await fetch(`/api/assets/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: notes[id] }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setDecidedCount((n) => n + 1);
    }
    setBusy(null);
  };

  const flaggedCount = items.filter((i) => i.integrity.verdict === "FLAGGED").length;
  const lookAlikeCount = items.filter((i) => i.phashMatches.some((m) => m.match)).length;
  const onlineCount = items.filter((i) => i.webMatches.length > 0).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Human review
          </span>
        }
        title="Review"
        description="Photos the automatic checks couldn't confirm. Approve or reject each one; your decision and note are added to the audit trail."
        actions={
          <Link href="/ledger" className="btn btn-secondary">
            <History className="h-4 w-4" />
            Audit trail
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-[104px] rounded-2xl" />
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card grid overflow-hidden lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="skeleton aspect-[4/3] lg:aspect-auto lg:min-h-[360px]" />
              <div className="space-y-4 p-6">
                <div className="skeleton h-5 w-48 rounded-md" />
                <div className="skeleton h-20 w-full rounded-xl" />
                <div className="skeleton h-16 w-full rounded-lg" />
                <div className="flex gap-2">
                  <div className="skeleton h-11 w-32 rounded-xl" />
                  <div className="skeleton h-11 w-28 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-emerald-100 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(5,150,105,0.10)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
          <div className="relative mx-auto flex max-w-md flex-col items-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 -m-4 rounded-full bg-emerald-300/40 blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_16px_32px_-12px_rgba(5,150,105,0.7)] ring-8 ring-white">
                <Check className="h-10 w-10" strokeWidth={2.5} />
              </div>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">All caught up</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">
              {decidedCount > 0 ? (
                <>
                  You reviewed <span className="font-medium text-zinc-900 tabular-nums">{decidedCount}</span>{" "}
                  {decidedCount === 1 ? "photo" : "photos"}. Every decision is now in the audit trail.
                </>
              ) : (
                "No photos are waiting for a decision. Photos that need a second look will appear here."
              )}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <Link href="/projects" className="btn btn-primary">
                <FolderKanban className="h-4 w-4" />
                Back to projects
              </Link>
              <Link href="/ledger" className="btn btn-secondary">
                <History className="h-4 w-4" />
                See the audit trail
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Waiting for you"
              value={items.length}
              icon={Inbox}
              tone="amber"
              hint={decidedCount > 0 ? `${decidedCount} done this visit` : "Need a decision"}
            />
            <Stat label="Flagged by checks" value={flaggedCount} icon={ShieldAlert} tone="red" hint="Likely problems" />
            <Stat label="Look-alike photos" value={lookAlikeCount} icon={Copy} tone="zinc" hint="Match another photo" />
            <Stat label="Found online" value={onlineCount} icon={Globe} tone="sky" hint="Same image on the web" />
          </div>

          <ul className="space-y-6">
            {items.map((item) => {
              const match = item.phashMatches[0]?.match ? item.phashMatches[0] : null;
              const issues = item.integrity.checks.filter((c) => c.status === "fail" || c.status === "warn");
              const flagged = item.integrity.verdict === "FLAGGED";
              const taken = takenLabel(item.capturedAt);
              const photo = withTransformation(
                item.secureUrl,
                "c_limit,w_1000/f_auto,q_auto",
                item.resourceType === "video" ? "jpg" : undefined
              );
              const isBusy = busy === item.id;
              return (
                <li key={item.id} className="card grid overflow-hidden lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                  {/* Photo on a dark stage so the whole frame is visible */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-zinc-950 lg:aspect-auto lg:min-h-[380px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="Submitted photo" className="absolute inset-0 h-full w-full object-contain" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5">
                      <span className="photo-chip">
                        <CalendarDays className="h-3 w-3 text-sky-600" />
                        {taken ? `Taken ${taken}` : "No capture date"}
                      </span>
                    </div>
                  </div>

                  {/* Verdict, reason and decision */}
                  <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/projects/${item.project.id}`}
                          className="group inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-900"
                        >
                          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.project.name}</span>
                        </Link>
                        <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
                          {flagged ? "Flagged by the checks" : "Couldn't be confirmed"}
                        </h3>
                        {item.manualNotes && <p className="line-clamp-2 text-[13px] text-zinc-500">{item.manualNotes}</p>}
                      </div>
                      <TrustBadge integrity={item.integrity} size="lg" />
                    </div>

                    {/* Why it needs review */}
                    <div
                      className={cx(
                        "flex gap-3 rounded-xl p-4 ring-1 ring-inset",
                        flagged ? "bg-red-50/70 ring-red-600/15" : "bg-amber-50/80 ring-amber-600/20"
                      )}
                    >
                      <span
                        className={cx(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          flagged ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {flagged ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <p className={cx("text-[13px] font-semibold", flagged ? "text-red-800" : "text-amber-800")}>
                          Why it needs review
                        </p>
                        <p className="text-sm leading-relaxed text-zinc-800">{reviewReason(item)}</p>
                      </div>
                    </div>

                    {/* The closest look-alike, side by side */}
                    {match?.match && (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                          <figure className="min-w-0 space-y-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getThumbnailUrl(item.secureUrl, item.resourceType)}
                              alt="This photo"
                              className="aspect-[4/3] w-full rounded-lg bg-zinc-100 object-cover ring-1 ring-black/5"
                            />
                            <figcaption className="truncate text-xs font-medium text-zinc-700">This photo</figcaption>
                          </figure>
                          <span
                            className="rounded-full bg-white px-2 py-1 text-xs font-semibold tabular-nums text-red-700 shadow-sm ring-1 ring-red-600/15"
                            title="How alike the two photos look"
                          >
                            {Math.round((1 - match.hamming / 64) * 100)}%
                          </span>
                          <figure className="min-w-0 space-y-1.5">
                            <Link href={`/verify/${match.match.id}`} target="_blank" className="group block overflow-hidden rounded-lg">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={getThumbnailUrl(match.match.secureUrl, match.match.resourceType)}
                                alt="Similar photo"
                                className="aspect-[4/3] w-full rounded-lg bg-zinc-100 object-cover ring-1 ring-black/5 transition duration-500 group-hover:scale-[1.04]"
                              />
                            </Link>
                            <figcaption className="truncate text-xs text-zinc-500">
                              In <span className="font-medium text-zinc-700">{match.match.project.name}</span>
                            </figcaption>
                          </figure>
                        </div>
                        <p className="mt-2.5 text-xs text-zinc-500">
                          These look almost the same{match.crossProject ? ", and the other one belongs to a different project" : ""}.
                        </p>
                      </div>
                    )}

                    {(issues.length > 0 || item.webMatches.length > 0) && (
                      <details className="group rounded-xl border border-zinc-200 bg-white">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-medium text-zinc-700 transition hover:text-zinc-900 [&::-webkit-details-marker]:hidden">
                          <span className="flex items-center gap-2">
                            What the checks found
                            {issues.length > 0 && (
                              <span className="rounded-md bg-zinc-100 px-1.5 text-xs font-medium tabular-nums text-zinc-500">
                                {issues.length}
                              </span>
                            )}
                          </span>
                          <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
                        </summary>
                        <div className="space-y-4 border-t border-zinc-100 p-3.5">
                          {issues.length > 0 && <CheckList checks={issues} compact />}
                          {item.webMatches.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-700">
                                <Globe className="h-3.5 w-3.5 text-sky-600" />
                                Also found online
                              </p>
                              <ul className="space-y-1">
                                {item.webMatches.slice(0, 3).map((w) => (
                                  <li key={w.id} className="truncate text-xs">
                                    <a
                                      href={w.url}
                                      target="_blank"
                                      rel="noopener noreferrer nofollow"
                                      className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
                                    >
                                      {w.pageTitle || w.url}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </details>
                    )}

                    <div className="mt-auto space-y-3 border-t border-zinc-100 pt-5">
                      <textarea
                        rows={2}
                        aria-label="Reviewer note"
                        placeholder="Add a note (optional), e.g. called the field officer and confirmed the original"
                        value={notes[item.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                        className="input resize-none"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decide(item.id, "APPROVED")}
                          disabled={isBusy}
                          className="btn btn-primary btn-lg flex-1 sm:flex-none"
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(item.id, "REJECTED")}
                          disabled={isBusy}
                          className="btn btn-lg flex-1 border border-red-200 bg-white text-red-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-red-300 hover:bg-red-50 sm:flex-none"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </button>
                        <Link
                          href={`/verify/${item.id}`}
                          target="_blank"
                          className="btn btn-ghost w-full sm:ml-auto sm:w-auto"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Full details
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewQueue />
    </Suspense>
  );
}
