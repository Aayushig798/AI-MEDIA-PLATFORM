"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Printer, Pencil, Save, X } from "lucide-react";
import { withTransformation, overlayId, EVIDENCE_TRANSFORMATION } from "@/lib/cloudinary-url";
import { COMPARE_FRAME } from "@/lib/change-metric";
import type { ReportFacts } from "@/lib/reports/facts";

interface Report {
  id: string;
  title: string;
  facts: ReportFacts;
  narrative: string;
  narrativeBy: string;
  createdAt: string;
}

function Qr({ url, size = 72 }: { url: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/qr?url=${encodeURIComponent(url)}`} alt="Verify QR" width={size} height={size} />;
}

export default function ReportPage() {
  const projectId = useParams().id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(process.env.NEXT_PUBLIC_BASE_URL || window.location.origin), []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/reports`);
    const data = await res.json();
    if (data.success) setReport(data.reports[0] ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    try {
      setGenerating(true);
      setError("");
      const res = await fetch(`/api/projects/${projectId}/reports`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate report");
      setReport(data.report);
      setNote(data.llmNote && !String(data.llmNote).includes("not set") ? data.llmNote : "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = async () => {
    if (!report) return;
    setError("");
    const res = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narrative: draft }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data.error || "Failed to save");
      return;
    }
    setReport(data.report);
    setEditing(false);
  };

  const f = report?.facts;

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 text-emerald-400" /> Back to project
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            id="generate-report-btn"
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {report ? "Regenerate from current facts" : "Generate report"}
          </button>
          {report && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold bg-white/10 hover:bg-white/15 text-slate-100"
            >
              <Printer className="w-3.5 h-3.5" /> Print / save PDF
            </button>
          )}
        </div>
      </div>

      {(error || note) && (
        <p className={`print:hidden text-xs ${error ? "text-red-300" : "text-amber-300"}`}>{error || note}</p>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
        </div>
      ) : !report || !f ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-slate-300">
          No report yet. Reports are built from verified evidence only: facts are computed first, with no AI, and the narrative may
          only restate them.
        </div>
      ) : (
        <article className="bg-white text-slate-900 rounded-2xl p-8 sm:p-12 shadow-2xl print:shadow-none print:rounded-none print:p-0 space-y-8">
          <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Verified impact report</p>
              <h1 className="text-3xl font-extrabold mt-1">{f.project.name}</h1>
              <p className="text-sm text-slate-600 mt-1">
                {f.project.location}
                {f.project.startDate && ` · since ${f.project.startDate}`} · generated {report.createdAt.slice(0, 10)}
              </p>
              {f.project.claim && <p className="text-sm text-slate-700 mt-2 italic">Claim: “{f.project.claim}”</p>}
            </div>
            {origin && (
              <div className="text-center shrink-0">
                <Qr url={`${origin}/ledger?projectId=${f.project.id}`} size={88} />
                <p className="text-[9px] text-slate-500 mt-1">Project ledger</p>
              </div>
            )}
          </header>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ["Field assets", f.assets.total],
              ["Cited as evidence", f.assets.verified],
              ["Flagged", f.assets.flagged],
              ["Awaiting review / unverified", f.assets.awaitingReview + f.assets.unverified],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-slate-200 p-4">
                <p className="text-3xl font-black tabular-nums">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Summary</h2>
              <span className="text-[11px] text-slate-500 flex items-center gap-2">
                Narrative: {report.narrativeBy === "template" ? "fact template (no AI)" : `${report.narrativeBy}, number-checked against facts`}
                {!editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(report.narrative);
                      setEditing(true);
                    }}
                    className="print:hidden inline-flex items-center gap-1 text-emerald-700 hover:underline"
                  >
                    <Pencil className="w-3 h-3" /> edit
                  </button>
                )}
              </span>
            </div>
            {editing ? (
              <div className="space-y-2 print:hidden">
                <textarea
                  rows={10}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm leading-relaxed"
                />
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={saveEdit} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">
                    <Save className="w-3.5 h-3.5" /> Save (numbers are checked)
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              report.narrative.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-800">
                  {p}
                </p>
              ))
            )}
          </section>

          {f.measured.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold">Measured change</h2>
              {f.measured.map((m) => (
                <div key={m.comparisonId} className="grid grid-cols-3 gap-3 break-inside-avoid">
                  {/* eslint-disable @next/next/no-img-element */}
                  {[
                    [m.beforeUrl, `Before · ${m.beforeDate}`, COMPARE_FRAME],
                    [m.afterUrl, `After · ${m.afterDate}`, COMPARE_FRAME],
                    [m.afterUrl, "Change mask (illustrative)", m.maskPublicId ? `${COMPARE_FRAME}/l_${overlayId(m.maskPublicId)},o_70/fl_layer_apply` : COMPARE_FRAME],
                  ].map(([src, caption, t]) => {
                    return (
                      <figure key={caption} className="space-y-1">
                        {src && <img src={withTransformation(src, `${t}/f_auto,q_auto`)} alt={caption} className="w-full aspect-[4/3] object-cover rounded-lg" />}
                        <figcaption className="text-[11px] text-slate-500">{caption}</figcaption>
                      </figure>
                    );
                  })}
                  <p className="col-span-3 text-sm">
                    <b>
                      {m.metric === "GREEN_COVER" ? "Green cover" : "Water area"}: {m.beforePct}% → {m.afterPct}% ({m.deltaPp > 0 ? "+" : ""}
                      {m.deltaPp} pp)
                    </b>
                    {m.location && ` at ${m.location}`}.
                    {m.satellite && ` Sentinel-2 ${String(m.satellite.index).toUpperCase()} ${m.satellite.before} → ${m.satellite.after}${m.satellite.agrees ? " (agrees)" : " (disagrees)"}.`}
                    <span className="block text-[11px] text-slate-500">Method: {m.method}</span>
                  </p>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-bold">Cited evidence</h2>
            <p className="text-xs text-slate-500">Only assets that passed verification or human review are cited. Scan a code to check that photo independently.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {f.cited.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 p-2 space-y-2 break-inside-avoid">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={withTransformation(c.secureUrl, EVIDENCE_TRANSFORMATION, c.resourceType === "video" ? "jpg" : undefined)}
                    alt={c.location ?? "evidence"}
                    className="w-full aspect-[4/3] object-cover rounded-lg"
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] text-slate-600">
                      <p className="font-semibold text-slate-800">Trust {c.trustScore}{c.humanApproved ? " · human-approved" : ""}</p>
                      <p>{c.capturedAt}</p>
                      <p className="truncate max-w-[9rem]">{c.location}</p>
                    </div>
                    {origin && <Qr url={`${origin}/verify/${c.id}`} size={56} />}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 space-y-1">
            <p>
              Ledger: {f.ledger.projectEntries} entries for this project · chain {f.ledger.chainIntact ? "intact" : "BROKEN"} at report time · head{" "}
              <span className="font-mono">{f.ledger.headHash.slice(0, 16)}…</span>
            </p>
            <p>Report {report.id}. Facts were computed without AI; any narrative number not present in the facts is rejected.</p>
          </footer>
        </article>
      )}
    </div>
  );
}
