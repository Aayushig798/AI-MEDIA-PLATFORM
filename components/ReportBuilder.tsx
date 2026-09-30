"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  FileText,
  Check,
  Columns2,
  Eye,
  FileDown,
  ImageIcon,
  Pencil,
  QrCode,
  Sparkles,
  Video,
  ArrowRight,
  CalendarRange,
  Images,
  Tags,
} from "lucide-react";
import { getThumbnailUrl } from "@/lib/cloudinary-url";
import { effectiveVerdict, VERDICT_LABELS } from "@/components/TrustBadge";
import { IconChip, Tabs, cx } from "@/components/ui";

export interface ReportItem {
  id: string;
  projectId: string;
  title: string | null;
  generatedSummary: string;
  selectedAssetIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportBuilderProps {
  projectId: string;
  projectName: string;
}

type StepState = "done" | "active" | "upcoming";

function StepMarker({ n, state, size = "md" }: { n: number; state: StepState; size?: "sm" | "md" }) {
  return (
    <span
      className={cx(
        "relative z-[1] flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums transition",
        size === "md" ? "h-8 w-8 text-sm" : "h-7 w-7 text-xs",
        state === "upcoming"
          ? "bg-white text-zinc-400 ring-1 ring-inset ring-zinc-200"
          : "bg-emerald-600 text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.6)]",
        state === "active" && "ring-4 ring-emerald-100",
      )}
    >
      {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
    </span>
  );
}

function Step({
  n,
  title,
  description,
  state,
  last,
  children,
}: {
  n: number;
  title: string;
  description?: ReactNode;
  state: StepState;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative flex gap-3 sm:gap-4">
      {!last && (
        <span
          aria-hidden
          className={cx("absolute -bottom-8 left-4 top-10 w-px", state === "upcoming" ? "bg-zinc-200" : "bg-emerald-200")}
        />
      )}
      <StepMarker n={n} state={state} />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-0.5 pt-1">
          <h2 className={cx("text-base font-semibold tracking-tight", state === "upcoming" ? "text-zinc-400" : "text-zinc-900")}>
            {title}
          </h2>
          {description && <p className="text-sm text-zinc-500">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const VERDICT_DOT = {
  VERIFIED: "bg-emerald-500",
  REVIEW: "bg-amber-500",
  FLAGGED: "bg-red-500",
} as const;

export function ReportBuilder({ projectId, projectName }: ReportBuilderProps) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable draft fields
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [projectFacts, setProjectFacts] = useState<any>(null);
  const [projectAssets, setProjectAssets] = useState<any[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  // Presentational: edit form or document preview
  const [view, setView] = useState<"edit" | "preview">("edit");

  const fetchReportsAndFacts = async () => {
    try {
      setLoading(true);
      const [reportsRes, factsRes, assetsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/reports`),
        fetch(`/api/projects/${projectId}/impact-stats`),
        fetch(`/api/assets?projectId=${projectId}`),
      ]);

      const [reportsData, factsData, assetsData] = await Promise.all([
        reportsRes.json(),
        factsRes.json(),
        assetsRes.json(),
      ]);

      if (reportsData.success) {
        setReports(reportsData.reports || []);
        if (reportsData.reports.length > 0 && !selectedReport) {
          selectReport(reportsData.reports[0]);
        }
      }

      if (factsData.success) {
        setProjectFacts(factsData.facts);
      }

      if (assetsData.success) {
        setProjectAssets(assetsData.assets || []);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to load reports" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsAndFacts();
  }, [projectId]);

  const selectReport = (report: ReportItem) => {
    setSelectedReport(report);
    setDraftTitle(report.title || `${projectName} Impact Report`);
    setDraftSummary(report.generatedSummary || "");
    setSelectedAssetIds(report.selectedAssetIds || []);
    setMessage(null);
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      setMessage(null);
      const res = await fetch(`/api/projects/${projectId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAssetIds: selectedAssetIds.length > 0 ? selectedAssetIds : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        setReports([data.report, ...reports]);
        selectReport(data.report);
        setMessage({
          type: "success",
          text: "Report created from the project's verified facts. Review it below.",
        });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to generate report" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error generating report" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedReport) return;
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch(`/api/reports/${selectedReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          generatedSummary: draftSummary,
          selectedAssetIds,
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        setReports(reports.map((r) => (r.id === data.report.id ? data.report : r)));
        setSelectedReport(data.report);
        setMessage({ type: "success", text: "Changes saved." });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save draft" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error saving draft" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    if (!selectedReport) return;
    try {
      setExporting(true);
      setMessage(null);
      // Save any pending edits first
      await handleSaveDraft();

      const res = await fetch(`/api/reports/${selectedReport.id}/export`);
      if (!res.ok) {
        throw new Error(`Export failed with HTTP status ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-impact-report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: "success", text: "PDF downloaded." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        const remaining = reports.filter((r) => r.id !== reportId);
        setReports(remaining);
        if (remaining.length > 0) {
          selectReport(remaining[0]);
        } else {
          setSelectedReport(null);
          setDraftTitle("");
          setDraftSummary("");
        }
        setMessage({ type: "success", text: "Report deleted." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to delete report" });
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const wordCount = draftSummary.trim() ? draftSummary.trim().split(/\s+/).length : 0;
  const comparisons: any[] = projectFacts?.comparisons ?? [];

  const stepStates: StepState[] = selectedReport ? ["done", "active", "active"] : ["active", "upcoming", "upcoming"];
  const STEPS = ["Choose content", "Review and edit", "Export and share"];
  const photoScope =
    selectedAssetIds.length > 0
      ? `${selectedAssetIds.length} selected photo${selectedAssetIds.length === 1 ? "" : "s"}`
      : "All verified photos";

  return (
    <div className="space-y-6">
      {message && (
        <div
          role="status"
          className={`animate-fade-in flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset print:hidden ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-600/15"
              : "bg-red-50 text-red-700 ring-red-600/15"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Progress */}
      <ol className="card flex items-center gap-2 px-3 py-3 print:hidden sm:gap-3 sm:px-5 sm:py-4">
        {STEPS.map((title, idx) => {
          const state = stepStates[idx];
          return (
            <li key={title} className={cx("flex min-w-0 items-center gap-2 sm:gap-3", idx < STEPS.length - 1 && "flex-1")}>
              <StepMarker n={idx + 1} state={state} size="sm" />
              <span
                className={cx(
                  "min-w-0 truncate text-xs font-medium sm:text-sm",
                  state === "upcoming" ? "text-zinc-400" : "text-zinc-900",
                )}
              >
                {title}
              </span>
              {idx < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cx(
                    "hidden h-px min-w-[16px] flex-1 sm:block",
                    stepStates[idx + 1] === "upcoming" ? "bg-zinc-200" : "bg-emerald-300",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-8 print:hidden lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Steps */}
        <div className="min-w-0 space-y-10">
          <Step
            n={1}
            state={stepStates[0]}
            title="Choose content"
            description="Pick the photos to feature. If you pick none, every verified photo is included."
          >
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                  <ImageIcon className="h-4 w-4 text-zinc-400" />
                  Photos
                </span>
                <span
                  className={cx(
                    "badge tabular-nums",
                    selectedAssetIds.length > 0 ? "badge-green" : "badge-neutral",
                  )}
                >
                  {selectedAssetIds.length} of {projectAssets.length} selected
                </span>
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50/50">
                {projectAssets.length === 0 ? (
                  loading ? (
                    <div className="grid grid-cols-3 gap-2.5 p-3 sm:grid-cols-4 md:grid-cols-5">
                      {Array.from({ length: 10 }).map((_, n) => (
                        <div key={n} className="skeleton aspect-square rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-10 text-center text-sm text-zinc-500">This project has no photos yet.</p>
                  )
                ) : (
                  <div className="grid max-h-[420px] grid-cols-3 gap-2.5 overflow-y-auto p-3 sm:grid-cols-4 md:grid-cols-5">
                    {projectAssets.map((asset) => {
                      const isChecked = selectedAssetIds.includes(asset.id);
                      const verdict = effectiveVerdict(asset.integrity);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => toggleAssetSelection(asset.id)}
                          aria-pressed={isChecked}
                          aria-label="Include in report"
                          className={cx(
                            "group relative aspect-square overflow-hidden rounded-xl bg-zinc-100 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                            isChecked
                              ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-50"
                              : "ring-1 ring-zinc-200 hover:ring-zinc-300",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getThumbnailUrl(asset.secureUrl, asset.resourceType)}
                            alt=""
                            loading="lazy"
                            className={cx(
                              "h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]",
                              isChecked && "scale-[1.02]",
                            )}
                          />
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                          {isChecked && <div className="absolute inset-0 bg-emerald-500/10" />}

                          <span
                            className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-white/90 px-1 py-0.5 shadow-sm ring-1 ring-black/5"
                            title={verdict ? VERDICT_LABELS[verdict] : VERDICT_LABELS.UNVERIFIED}
                          >
                            <span className={cx("h-1.5 w-1.5 rounded-full", verdict ? VERDICT_DOT[verdict] : "bg-zinc-400")} />
                            {asset.resourceType === "video" && <Video className="h-3 w-3 text-zinc-700" />}
                          </span>

                          <span
                            className={cx(
                              "absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full transition",
                              isChecked
                                ? "bg-emerald-500 text-white shadow-[0_2px_6px_rgba(5,150,105,0.5)]"
                                : "bg-black/20 ring-1 ring-inset ring-white/80 backdrop-blur-sm",
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>

                          <span className="absolute bottom-1.5 left-2 right-2 truncate text-[11px] font-medium text-white">
                            {asset.manualCategory || "Uncategorized"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                  The text is drafted automatically from this project&apos;s verified facts. You can edit it next.
                </p>
                <button
                  id="generate-impact-report-btn"
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="btn btn-primary shrink-0"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? "Writing report…" : selectedReport ? "Generate new report" : "Generate report"}
                </button>
              </div>
            </div>
          </Step>

          <Step
            n={2}
            state={stepStates[1]}
            title="Review and edit"
            description={selectedReport ? "Edit anything you like. The PDF uses this text exactly as written." : undefined}
          >
            {selectedReport ? (
              <div className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                  <Tabs
                    value={view}
                    onChange={setView}
                    items={[
                      { value: "edit", label: "Edit", icon: Pencil },
                      { value: "preview", label: "Preview", icon: Eye },
                    ]}
                  />
                  <span className="text-xs tabular-nums text-zinc-400">
                    {wordCount} words · {draftSummary.length} characters
                  </span>
                </div>

                {/* Edit form stays mounted so its fields keep their ids */}
                <div className={cx("space-y-5 p-5 sm:p-6", view !== "edit" && "hidden")}>
                  <div>
                    <label htmlFor="report-title-input" className="label">
                      Title
                    </label>
                    <input
                      id="report-title-input"
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="input h-10 text-[15px] font-medium"
                    />
                  </div>

                  <div>
                    <label htmlFor="report-narrative-textarea" className="label">
                      Summary
                    </label>
                    <textarea
                      id="report-narrative-textarea"
                      rows={12}
                      value={draftSummary}
                      onChange={(e) => setDraftSummary(e.target.value)}
                      placeholder="Write the report summary…"
                      className="input text-sm leading-relaxed"
                    />
                  </div>

                  {comparisons.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                          <Columns2 className="h-4 w-4 text-zinc-400" />
                          Before-and-after pairs in the PDF
                        </h3>
                        <span className="badge badge-neutral tabular-nums">{comparisons.length}</span>
                      </div>
                      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl ring-1 ring-inset ring-zinc-200">
                        {comparisons.map((c: any) => (
                          <li key={c.id} className="flex items-start gap-3 px-3.5 py-3">
                            <IconChip icon={c.verified ? CheckCircle2 : Columns2} tone={c.verified ? "emerald" : "zinc"} size="sm" />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-medium capitalize text-zinc-900">
                                  {c.location || "Before and after"}
                                </span>
                                <span className={`badge shrink-0 ${c.verified ? "badge-green" : "badge-neutral"}`}>
                                  {c.verified ? "Same place confirmed" : "Not confirmed"}
                                </span>
                              </div>
                              <p className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-zinc-500">
                                Before {c.beforeDate || "unknown date"}
                                <ArrowRight className="h-3 w-3 text-zinc-400" />
                                After {c.afterDate || "unknown date"}
                              </p>
                              {c.changeSummary && <p className="truncate text-xs text-zinc-500">{c.changeSummary}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {view === "preview" && (
                  <div className="bg-zinc-100/80 px-3 py-6 sm:px-8 sm:py-10">
                    <article className="mx-auto max-w-2xl rounded-md bg-white px-6 py-8 shadow-[0_1px_3px_rgba(16,24,40,0.08),0_28px_56px_-28px_rgba(16,24,40,0.35)] ring-1 ring-zinc-200/70 sm:px-12 sm:py-12">
                      <div className="h-1 w-12 rounded-full bg-emerald-500" />
                      <p className="mt-6 text-[13px] font-medium text-emerald-700">{projectName}</p>
                      <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-[28px]">
                        {draftTitle || "Impact report"}
                      </h1>
                      <p className="mt-2 text-xs tabular-nums text-zinc-500">
                        {formatDate(selectedReport.createdAt)} · {photoScope}
                      </p>

                      <div className="mt-6 whitespace-pre-wrap border-t border-zinc-100 pt-6 text-[15px] leading-7 text-zinc-700">
                        {draftSummary || <span className="text-zinc-400">No summary yet.</span>}
                      </div>

                      {comparisons.length > 0 && (
                        <section className="mt-10">
                          <h2 className="text-sm font-semibold text-zinc-900">Before-and-after pairs</h2>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[420px] border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-zinc-200 text-zinc-500">
                                  <th className="py-2 pr-3 font-medium">Location</th>
                                  <th className="py-2 pr-3 font-medium">Before</th>
                                  <th className="py-2 pr-3 font-medium">After</th>
                                  <th className="py-2 font-medium">Same place</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparisons.map((c: any) => (
                                  <tr key={c.id} className="border-b border-zinc-100 align-top text-zinc-700">
                                    <td className="py-2 pr-3 capitalize">{c.location || "—"}</td>
                                    <td className="py-2 pr-3 tabular-nums">{c.beforeDate || "—"}</td>
                                    <td className="py-2 pr-3 tabular-nums">{c.afterDate || "—"}</td>
                                    <td className="py-2">
                                      {c.verified ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-700">
                                          <Check className="h-3 w-3" /> Confirmed
                                        </span>
                                      ) : (
                                        "Not confirmed"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      <footer className="mt-10 flex items-center gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
                        <QrCode className="h-3.5 w-3.5 shrink-0" />
                        The PDF adds QR codes that link to each photo&apos;s public verification page.
                      </footer>
                    </article>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-10 text-center">
                <Pencil className="h-5 w-5 text-zinc-300" />
                <p className="mt-2 text-sm text-zinc-500">Generate a report in step 1 to review it here.</p>
              </div>
            )}
          </Step>

          <Step
            n={3}
            state={stepStates[2]}
            last
            title="Export and share"
            description={
              selectedReport
                ? "Download a PDF to share. It includes QR codes that link to each photo's public verification page."
                : undefined
            }
          >
            {selectedReport ? (
              <div className="card overflow-hidden">
                <div className="flex flex-col gap-4 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3.5">
                    <IconChip icon={FileDown} tone="emerald" size="lg" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">PDF report</p>
                      <p className="text-xs text-zinc-500">Downloading also saves your latest changes.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      id="save-report-draft-btn"
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="btn btn-secondary"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      id="export-report-pdf-btn"
                      onClick={handleExportPdf}
                      disabled={exporting}
                      className="btn btn-primary"
                    >
                      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {exporting ? "Preparing PDF…" : "Download PDF"}
                    </button>
                  </div>
                </div>
                <ul className="grid grid-cols-1 gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-3">
                  {[
                    { icon: Pencil, text: "Your edited text" },
                    { icon: Columns2, text: "Before-and-after pairs" },
                    { icon: QrCode, text: "QR codes to verification pages" },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-2 bg-white px-4 py-3 text-xs text-zinc-600">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Available once you have a report.</p>
            )}
          </Step>
        </div>

        {/* Sidebar: saved reports and source facts */}
        <aside className="space-y-5">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <h2 className="flex items-center gap-2.5 text-sm font-semibold text-zinc-900">
                <IconChip icon={FileText} tone="emerald" size="sm" />
                Saved reports
                <span className="badge badge-neutral tabular-nums">{reports.length}</span>
              </h2>
              <button
                onClick={fetchReportsAndFacts}
                disabled={loading}
                className="btn btn-ghost btn-sm btn-icon"
                title="Refresh"
                aria-label="Refresh reports"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loading && reports.length === 0 ? (
              <div className="space-y-2 border-t border-zinc-100 p-3">
                {[0, 1, 2].map((n) => (
                  <div key={n} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center gap-2 border-t border-zinc-100 px-4 py-10 text-center">
                <FileText className="h-5 w-5 text-zinc-300" />
                <p className="text-sm text-zinc-500">No reports yet.</p>
              </div>
            ) : (
              <div className="max-h-[480px] divide-y divide-zinc-100 overflow-y-auto border-t border-zinc-100">
                {reports.map((report) => {
                  const isSelected = selectedReport?.id === report.id;
                  return (
                    <div
                      key={report.id}
                      onClick={() => selectReport(report)}
                      className={cx(
                        "group relative flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                        isSelected ? "bg-emerald-50/60" : "hover:bg-zinc-50",
                      )}
                    >
                      {isSelected && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-emerald-500" />}
                      <IconChip icon={FileText} tone={isSelected ? "emerald" : "zinc"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className={cx("truncate text-sm", isSelected ? "font-medium text-zinc-900" : "text-zinc-700")}>
                          {report.title || "Impact Report"}
                        </div>
                        <div className="mt-0.5 text-xs tabular-nums text-zinc-500">
                          {formatDate(report.createdAt)} · {report.selectedAssetIds?.length || 0} photos
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        {isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPdf();
                            }}
                            disabled={exporting}
                            className="btn btn-ghost btn-sm btn-icon text-emerald-700 hover:bg-emerald-100/70 hover:text-emerald-800"
                            title="Download PDF"
                            aria-label="Download PDF"
                          >
                            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteReport(report.id);
                          }}
                          className="btn btn-ghost btn-sm btn-icon text-zinc-400 hover:text-red-600"
                          title="Delete report"
                          aria-label="Delete report"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {projectFacts && (
            <details className="group card overflow-hidden" open>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
                What the report is based on
                <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-zinc-100 px-4 py-3.5">
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-zinc-500">
                      <Images className="h-3.5 w-3.5 text-zinc-400" /> Photos and videos
                    </dt>
                    <dd className="font-medium tabular-nums text-zinc-900">{projectFacts.totalAssets}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-zinc-500">
                      <Columns2 className="h-3.5 w-3.5 text-zinc-400" /> Before-and-after pairs
                    </dt>
                    <dd className="text-right font-medium tabular-nums text-zinc-900">
                      {projectFacts.totalComparisons}{" "}
                      <span className="font-normal text-zinc-500">({projectFacts.verifiedComparisonsCount} confirmed)</span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-zinc-500">
                      <CalendarRange className="h-3.5 w-3.5 text-zinc-400" /> Dates
                    </dt>
                    <dd className="text-right text-xs tabular-nums text-zinc-900">
                      {projectFacts.dateRange
                        ? `${new Date(projectFacts.dateRange.from).toLocaleDateString()} – ${new Date(projectFacts.dateRange.to).toLocaleDateString()}`
                        : "Open"}
                    </dd>
                  </div>
                </dl>
                {Object.keys(projectFacts.categoryBreakdown).length > 0 && (
                  <div className="space-y-2 border-t border-zinc-100 pt-3">
                    <p className="flex items-center gap-2 text-xs text-zinc-500">
                      <Tags className="h-3.5 w-3.5 text-zinc-400" /> Categories
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(projectFacts.categoryBreakdown).map(([cat, count]: any) => (
                        <span key={cat} className="badge badge-neutral">
                          {cat} <span className="tabular-nums text-zinc-400">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </aside>
      </div>

      {/* Print view: a plain black-on-white copy of the current report */}
      {selectedReport && (
        <article className="hidden bg-white text-black print:block">
          <header className="border-b border-black pb-4">
            <p className="text-sm">{projectName}</p>
            <h1 className="mt-1 text-2xl font-semibold">{draftTitle || "Impact report"}</h1>
            <p className="mt-1 text-xs">{formatDate(selectedReport.createdAt)}</p>
          </header>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{draftSummary}</div>
          {comparisons.length > 0 && (
            <section className="mt-8 break-inside-avoid">
              <h2 className="text-base font-semibold">Before-and-after pairs</h2>
              <table className="mt-2 w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-1.5 pr-3 font-semibold">Location</th>
                    <th className="py-1.5 pr-3 font-semibold">Before</th>
                    <th className="py-1.5 pr-3 font-semibold">After</th>
                    <th className="py-1.5 font-semibold">Same place</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((c: any) => (
                    <tr key={c.id} className="border-b border-zinc-300 align-top">
                      <td className="py-1.5 pr-3">{c.location || "—"}</td>
                      <td className="py-1.5 pr-3">{c.beforeDate || "—"}</td>
                      <td className="py-1.5 pr-3">{c.afterDate || "—"}</td>
                      <td className="py-1.5">{c.verified ? "Confirmed" : "Not confirmed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </article>
      )}
    </div>
  );
}
