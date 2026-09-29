"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Save,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Image as ImageIcon,
  Calendar,
  MapPin,
  RefreshCw,
  Plus,
  ExternalLink,
} from "lucide-react";

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
          text: "Report generated successfully using grounded project facts & audit logs!",
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
        setMessage({ type: "success", text: "Report draft saved successfully." });
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

      setMessage({ type: "success", text: "PDF downloaded successfully!" });
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

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel rounded-2xl p-4 border border-white/10">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span>Impact Intelligence Report Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strictly fact-grounded synthesis with editable narratives and PDF export
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="generate-impact-report-btn"
            onClick={handleGenerateReport}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{generating ? "Synthesizing Facts..." : "Generate AI Impact Report"}</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Left Reports List / Right Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Saved Reports list (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Saved Reports ({reports.length})
              </span>
              <button
                onClick={fetchReportsAndFacts}
                disabled={loading}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
                title="Refresh reports"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loading && reports.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Loading reports...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                <p>No reports generated yet.</p>
                <p className="text-[11px] text-slate-600">
                  Click &quot;Generate AI Impact Report&quot; to synthesize project evidence into an executive draft.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {reports.map((report) => {
                  const isSelected = selectedReport?.id === report.id;
                  const dateStr = new Date(report.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <div
                      key={report.id}
                      onClick={() => selectReport(report)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-2 ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                          : "bg-slate-900/50 border-white/5 text-slate-300 hover:bg-slate-900 hover:border-white/15"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {report.title || "Impact Report"}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dateStr}
                          </span>
                          <span>•</span>
                          <span>{report.selectedAssetIds?.length || 0} assets</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReport(report.id);
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                        title="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Structured Facts Grounding Panel */}
          {projectFacts && (
            <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block pb-2 border-b border-white/10">
                Ground Truth Reference Metrics
              </span>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Catalogued Assets:</span>
                  <strong className="text-white">{projectFacts.totalAssets}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Observation Pairs:</span>
                  <strong className="text-white">
                    {projectFacts.totalComparisons} ({projectFacts.verifiedComparisonsCount} verified)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timeline Window:</span>
                  <span className="text-right text-[11px] text-slate-300 font-mono">
                    {projectFacts.dateRange
                      ? `${new Date(projectFacts.dateRange.from).toLocaleDateString()} — ${new Date(projectFacts.dateRange.to).toLocaleDateString()}`
                      : "Open"}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[11px] text-slate-400 block mb-1.5">Categories:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(projectFacts.categoryBreakdown).map(([cat, count]: any) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                      >
                        {cat}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Editor & PDF Export (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {selectedReport ? (
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-5">
              {/* Header with Title Input & Action Buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Report Title
                  </label>
                  <input
                    id="report-title-input"
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    id="save-report-draft-btn"
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold disabled:opacity-50 transition"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{saving ? "Saving..." : "Save Draft"}</span>
                  </button>

                  <button
                    id="export-report-pdf-btn"
                    onClick={handleExportPdf}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
                  >
                    {exporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{exporting ? "Rendering PDF..." : "Export as PDF"}</span>
                  </button>
                </div>
              </div>

              {/* Narrative Textarea */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Executive Impact Narrative (Editable Draft)</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">
                    {wordCount} words • {draftSummary.length} characters
                  </span>
                </div>
                <textarea
                  id="report-narrative-textarea"
                  rows={9}
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  placeholder="Grounded executive impact narrative..."
                  className="w-full p-4 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-200 leading-relaxed font-sans placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Tip: You can freely edit this narrative prior to PDF export. It will be printed directly in the final document.
                </p>
              </div>

              {/* Included Visual Evidence Comparisons Preview */}
              {projectFacts?.comparisons && projectFacts.comparisons.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Included Observation Pairs in PDF</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {projectFacts.comparisons.length} pairs catalogued
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projectFacts.comparisons.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300 truncate">
                            {c.location || "Observation Pair"}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              c.verified
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {c.verified ? "✓ Verified" : "Unverified"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span>Before: {c.beforeDate || "N/A"}</span>
                          <span>After: {c.afterDate || "N/A"}</span>
                        </div>
                        {c.changeSummary && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {c.changeSummary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Asset Selection Matrix for Audit & Gallery Section */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
                      <span>Select Assets to Associate with this Report</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Selected assets will be logged as &quot;used_in_report&quot; in the audit trail and highlighted in the PDF.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {selectedAssetIds.length} of {projectAssets.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                  {projectAssets.map((asset) => {
                    const isChecked = selectedAssetIds.includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => toggleAssetSelection(asset.id)}
                        className={`relative rounded-xl overflow-hidden border cursor-pointer transition ${
                          isChecked
                            ? "border-emerald-500 ring-2 ring-emerald-500/30"
                            : "border-white/10 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="h-20 bg-black">
                          <img
                            src={asset.secureUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-1.5 bg-slate-900/90 text-[10px] flex items-center justify-between">
                          <span className="truncate max-w-[80px] text-slate-300">
                            {asset.manualCategory || "Uncategorized"}
                          </span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-3 h-3 rounded accent-emerald-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-white/10">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="max-w-sm mx-auto space-y-1">
                <h3 className="text-sm font-bold text-slate-200">No Report Selected</h3>
                <p className="text-xs text-slate-400">
                  Select an existing report from the left panel, or click the button below to generate a new executive synthesis.
                </p>
              </div>
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Generate First Impact Report</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
