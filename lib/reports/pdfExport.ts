import puppeteer from "puppeteer";

export interface ReportPdfData {
  projectName: string;
  projectLocation?: string | null;
  reportTitle?: string;
  generatedSummary: string;
  createdAt: string | Date;
  metrics: {
    totalAssets: number;
    categoryBreakdown: Record<string, number>;
    dateRange: { from: string; to: string } | null;
    verifiedComparisonsCount: number;
    totalComparisons: number;
  };
  comparisons?: Array<{
    id: string;
    beforeUrl: string;
    afterUrl: string;
    beforeDate?: string | null;
    afterDate?: string | null;
    location?: string | null;
    verified: boolean;
    changeSummary?: string | null;
    aiReason?: string | null;
  }>;
  selectedAssets?: Array<{
    id: string;
    url: string;
    category?: string | null;
    location?: string | null;
    capturedAt?: string | null;
    tags?: string[];
  }>;
}

/**
 * Builds a clean, professional, print-optimized HTML document for stakeholder reporting.
 */
export function buildReportHtml(data: ReportPdfData): string {
  const formattedDate = new Date(data.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dateSpan = data.metrics.dateRange
    ? `${new Date(data.metrics.dateRange.from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — ${new Date(data.metrics.dateRange.to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Dates open";

  const paragraphs = data.generatedSummary
    .split(/\n\n+/)
    .map((p) => `<p style="margin-bottom: 14px; line-height: 1.6; color: #2d3748; font-size: 13.5px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const categoryChips = Object.entries(data.metrics.categoryBreakdown)
    .map(
      ([cat, count]) =>
        `<span style="background: #edf2f7; color: #2d3748; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; margin-right: 6px; display: inline-block; margin-bottom: 6px;">${cat}: ${count}</span>`
    )
    .join("");

  const comparisonsHtml = (data.comparisons || [])
    .map(
      (comp, idx) => `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 18px; page-break-inside: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-weight: 700; font-size: 12.5px; color: #1a202c;">Observation Pair #${idx + 1} ${comp.location ? `• ${comp.location}` : ""}</span>
        <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 600; ${
          comp.verified
            ? "background: #dcfce7; color: #15803d;"
            : "background: #fef3c7; color: #b45309;"
        }">
          ${comp.verified ? "✓ AI-Verified Same Scene" : "⚠ Unverified Observation"}
        </span>
      </div>
      <div style="display: flex; gap: 12px; margin-bottom: 10px;">
        <div style="flex: 1; text-align: center;">
          <div style="border-radius: 6px; overflow: hidden; height: 160px; background: #000; border: 1px solid #cbd5e1;">
            <img src="${comp.beforeUrl}" style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600;">BEFORE: ${comp.beforeDate || "Undated"}</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="border-radius: 6px; overflow: hidden; height: 160px; background: #000; border: 1px solid #cbd5e1;">
            <img src="${comp.afterUrl}" style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600;">AFTER: ${comp.afterDate || "Undated"}</div>
        </div>
      </div>
      ${
        comp.changeSummary
          ? `<div style="font-size: 11.5px; color: #334155; background: #ffffff; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <strong>Documented Change:</strong> ${comp.changeSummary}
             </div>`
          : ""
      }
    </div>
  `
    )
    .join("");

  const assetsHtml = (data.selectedAssets || [])
    .slice(0, 6)
    .map(
      (asset) => `
    <div style="width: calc(33.333% - 10px); background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 12px; page-break-inside: avoid;">
      <div style="height: 110px; background: #000;">
        <img src="${asset.url}" style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />
      </div>
      <div style="padding: 8px 10px;">
        <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${asset.category || "Uncategorized"}</div>
        <div style="font-size: 10px; color: #64748b;">${asset.capturedAt ? new Date(asset.capturedAt).toLocaleDateString() : (asset.location || "Monitored asset")}</div>
      </div>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${data.projectName} — Impact Intelligence Report</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1a202c;
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kpi-box {
      flex: 1;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .kpi-val {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-lbl {
      font-size: 10.5px;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.1em; color: #059669; text-transform: uppercase; margin-bottom: 4px;">
        AI Media Platform • Grounded Impact Intelligence
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a;">${data.projectName}</h1>
      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
        ${data.projectLocation ? `Site: ${data.projectLocation} • ` : ""}Generated on ${formattedDate}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em;">
        VERIFIED EVIDENCE REPORT
      </div>
    </div>
  </div>

  <!-- KPI Metric Row -->
  <div style="display: flex; gap: 10px; margin-bottom: 20px;">
    <div class="kpi-box">
      <div class="kpi-val">${data.metrics.totalAssets}</div>
      <div class="kpi-lbl">Total Media Assets</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-val">${data.metrics.totalComparisons}</div>
      <div class="kpi-lbl">Observation Pairs</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-val">${data.metrics.verifiedComparisonsCount}</div>
      <div class="kpi-lbl">AI-Verified Pairs</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-val" style="font-size: 13px; margin-top: 5px; line-height: 1.2;">${dateSpan}</div>
      <div class="kpi-lbl">Observation Timeline</div>
    </div>
  </div>

  <!-- Category Breakdown Chips -->
  <div style="margin-bottom: 18px;">
    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 6px;">
      Domain Evidence Distribution
    </div>
    <div>${categoryChips}</div>
  </div>

  <!-- Executive Summary -->
  <div style="margin-bottom: 24px;">
    <div style="border-left: 3px solid #059669; padding-left: 10px; margin-bottom: 12px;">
      <h2 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">Executive Impact Narrative</h2>
      <div style="font-size: 10.5px; color: #64748b;">AI-synthesized from verified field logs & timestamps</div>
    </div>
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
      ${paragraphs}
    </div>
  </div>

  <!-- Visual Evidence Comparisons -->
  ${
    data.comparisons && data.comparisons.length > 0
      ? `
    <div style="margin-bottom: 22px;">
      <div style="border-left: 3px solid #3b82f6; padding-left: 10px; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">Before & After Visual Evidence</h2>
        <div style="font-size: 10.5px; color: #64748b;">Comparative chronological proof pairs</div>
      </div>
      ${comparisonsHtml}
    </div>
  `
      : ""
  }

  <!-- Monitored Assets Gallery -->
  ${
    data.selectedAssets && data.selectedAssets.length > 0
      ? `
    <div style="margin-bottom: 20px;">
      <div style="border-left: 3px solid #8b5cf6; padding-left: 10px; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">Key Catalogued Evidence</h2>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 15px;">
        ${assetsHtml}
      </div>
    </div>
  `
      : ""
  }

  <!-- Footer -->
  <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 24px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;">
    <div>Generated by AI Media Platform • Grounded Impact Reporting Engine</div>
    <div>Strictly Fact-Grounded Data • Page 1 of 1</div>
  </div>
</body>
</html>`;
}

/**
 * Converts HTML into an A4 PDF document using Puppeteer.
 */
export async function renderReportPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: ["load", "domcontentloaded"],
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "14mm",
        bottom: "14mm",
        left: "12mm",
        right: "12mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
