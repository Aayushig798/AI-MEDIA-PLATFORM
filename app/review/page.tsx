"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ListChecks, Loader2, UserCheck, UserX, ExternalLink, Fingerprint, Globe, PartyPopper } from "lucide-react";
import { TrustBadge } from "@/components/TrustBadge";
import { CheckList, CheckResultView } from "@/components/CheckList";
import { getThumbnailUrl, withTransformation } from "@/lib/cloudinary-url";

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

function ReviewQueue() {
  const projectId = useSearchParams().get("projectId");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

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
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    setBusy(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 uppercase tracking-wider">
          <ListChecks className="w-4 h-4" /> Needs human review
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Review queue</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          The Trust Score is triage, not a verdict. Each decision here is written to the tamper-evident ledger with your name and note.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-slate-300">
          <PartyPopper className="w-8 h-8 mx-auto text-emerald-400 mb-3" />
          Nothing waiting for review.
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((item) => (
            <div key={item.id} className="glass-panel rounded-2xl p-5 border border-white/5 grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/projects/${item.project.id}`} className="text-sm font-bold text-white hover:underline truncate">
                    {item.project.name}
                  </Link>
                  <TrustBadge integrity={item.integrity} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <figure className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={withTransformation(item.secureUrl, "c_fit,w_600/f_auto,q_auto", item.resourceType === "video" ? "jpg" : undefined)} alt="submitted" className="w-full aspect-square object-cover rounded-xl border border-amber-500/40" />
                    <figcaption className="text-[10px] text-slate-400">Submitted · {item.capturedAt?.slice(0, 10)}</figcaption>
                  </figure>
                  {item.phashMatches[0]?.match ? (
                    <figure className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getThumbnailUrl(item.phashMatches[0].match.secureUrl, item.phashMatches[0].match.resourceType)} alt="match" className="w-full aspect-square object-cover rounded-xl border border-rose-500/40" />
                      <figcaption className="text-[10px] text-rose-300">
                        <Fingerprint className="inline w-3 h-3" /> {Math.round((1 - item.phashMatches[0].hamming / 64) * 100)}% match ·{" "}
                        {item.phashMatches[0].match.project.name}
                      </figcaption>
                    </figure>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 flex items-center justify-center text-[11px] text-slate-500 p-3 text-center">
                      No matching photo in the library
                    </div>
                  )}
                </div>
                {item.webMatches.length > 0 && (
                  <ul className="space-y-0.5">
                    {item.webMatches.slice(0, 3).map((w) => (
                      <li key={w.id} className="text-[11px] truncate">
                        <Globe className="inline w-3 h-3 text-rose-300 mr-1" />
                        <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="text-cyan-300 hover:underline">
                          {w.pageTitle || w.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="xl:col-span-4">
                <CheckList checks={item.integrity.checks.filter((c) => c.status === "fail" || c.status === "warn")} compact />
              </div>

              <div className="xl:col-span-3 flex flex-col gap-2">
                <textarea
                  rows={3}
                  placeholder="Reviewer note (e.g. called field officer, confirmed original)"
                  value={notes[item.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 placeholder-slate-600"
                />
                <button
                  type="button"
                  onClick={() => decide(item.id, "APPROVED")}
                  disabled={busy === item.id}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" /> Approve as evidence
                </button>
                <button
                  type="button"
                  onClick={() => decide(item.id, "REJECTED")}
                  disabled={busy === item.id}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                >
                  <UserX className="w-4 h-4" /> Reject
                </button>
                <Link href={`/verify/${item.id}`} target="_blank" className="inline-flex items-center justify-center gap-1 text-[11px] text-slate-400 hover:text-white">
                  <ExternalLink className="w-3 h-3" /> Full verification page
                </Link>
              </div>
            </div>
          ))}
        </div>
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
