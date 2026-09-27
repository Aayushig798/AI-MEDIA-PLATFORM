# Phase 4: Impact Intelligence, Reporting & Full Traceability (Day 7–8)

**Timeline:** Day 7–8 (final phase)
**Goal:** Turn organized, searchable, comparable evidence into consumable outputs — LLM-generated impact reports exportable as PDF, plus complete per-asset traceability and a summary dashboard.
**Exit Criterion:** Generating a report produces an editable narrative grounded only in real project data, exports as an openable PDF with at least one before/after image, and any asset's full lifecycle (upload → AI tag → embed → comparison → report) is visible in a timeline view.
**Focus:** Generative AI, grounded strictly in structured facts assembled without AI. This is the final phase — after this, the full product works end to end.

## 1. Requirements Covered

| ID | Type | Description | Priority |
|---|---|---|---|
| FR-20 | Functional | Assemble structured project facts (counts, categories, comparisons, date range) with no AI. | Must |
| FR-21 | Functional | Generate an LLM narrative strictly grounded in those facts — no invented statistics. | Must |
| FR-22 | Functional | Editable draft narrative before export. | Must |
| FR-23 | Functional | Export report (narrative + images + comparisons) as a PDF. | Must |
| FR-24 | Functional | Full audit log per asset: uploaded → ai_tagged → embedded → used_in_comparison → used_in_report. | Must |
| FR-25 | Functional | Traceability timeline view per asset. | Must |
| FR-26 | Functional | Project dashboard: category breakdown chart, asset/comparison counts, location list/map. | Should |
| NFR-09 | Non-Functional | LLM must never be the source of truth for numbers — only narrates pre-computed facts. | Must |

## 2. Directory & File Structure (Phase 4 additions)

```
ai-media-platform/
├── lib/
│   ├── reports/
│   │   ├── factAssembly.ts       # Computes structured facts — NO AI here
│   │   ├── narrativeGen.ts       # Sends facts to LLM, returns draft
│   │   └── pdfExport.ts          # Puppeteer HTML -> PDF
│   └── audit/
│       └── logEvent.ts           # Single helper called from every event site
├── app/
│   ├── api/
│   │   ├── projects/[id]/
│   │   │   ├── impact-stats/route.ts       # GET structured facts
│   │   │   └── reports/route.ts            # POST generate report
│   │   ├── reports/[id]/
│   │   │   ├── route.ts                    # PATCH edit narrative
│   │   │   └── export/route.ts             # GET PDF export
│   │   └── assets/[id]/audit-log/route.ts  # GET timeline
│   ├── projects/[id]/
│   │   ├── report/page.tsx        # Report builder UI
│   │   └── dashboard/page.tsx     # Charts + counts
│   └── components/
│       ├── ReportBuilder.tsx
│       ├── TraceabilityTimeline.tsx
│       └── ImpactCharts.tsx
```

## 3. Step-by-Step Implementation Tasks

- [ ] **Task 4.1: Schema Additions**
  Add `Report` and `AssetAuditLog` models. Migrate.
- [ ] **Task 4.2: Structured Fact Assembly (no AI)**
  `lib/reports/factAssembly.ts` computes: total asset count, category breakdown, date range, saved `Comparison`s with dates/locations, manual notes. Expose via `GET /api/projects/[id]/impact-stats`.
- [ ] **Task 4.3: Retrofit Audit Logging**
  Add `logEvent()` calls at every existing event site from Phases 1–3: asset creation, AI tagging completion, embedding completion, comparison creation. Do this **before** building report generation, so report creation has something to log into as well.
- [ ] **Task 4.4: Grounded Narrative Generation**
  `lib/reports/narrativeGen.ts` sends the assembled facts (never raw, unprocessed media) to GPT-4o-mini with an explicit "use only these facts, do not invent numbers" instruction. `POST /api/projects/[id]/reports` stores the draft as a `Report` row and logs `used_in_report` for every included asset.
- [ ] **Task 4.5: Editable Draft + PDF Export**
  `PATCH /api/reports/[id]` saves user edits. `GET /api/reports/[id]/export` renders an HTML template (narrative + selected images/comparisons from Cloudinary URLs) and converts via Puppeteer.
- [ ] **Task 4.6: Traceability Timeline UI**
  `TraceabilityTimeline.tsx` reads `GET /api/assets/[id]/audit-log` and renders a chronological list with icon/label/timestamp/actor.
- [ ] **Task 4.7: Dashboard**
  `ImpactCharts.tsx` (Recharts) — category breakdown, asset/comparison counts, and a location list (or map if time allows) sourced from the same `impact-stats` endpoint.

## 4. Code Specifications

### 4.1 Prisma Schema Additions
```prisma
model Report {
  id               String   @id @default(cuid())
  projectId        String
  project          Project  @relation(fields: [projectId], references: [id])
  generatedSummary String   @db.Text
  selectedAssetIds String[]
  createdBy        String
  createdAt        DateTime @default(now())
}

model AssetAuditLog {
  id           String     @id @default(cuid())
  mediaAssetId String
  mediaAsset   MediaAsset @relation(fields: [mediaAssetId], references: [id])
  eventType    String     // "uploaded" | "ai_tagged" | "embedded" | "used_in_comparison" | "used_in_report"
  eventDetail  Json
  actor        String
  createdAt    DateTime   @default(now())
}
```

### 4.2 Audit Log Helper (`lib/audit/logEvent.ts`)
```typescript
import { db } from "@/lib/db";

export async function logEvent(
  mediaAssetId: string,
  eventType: "uploaded" | "ai_tagged" | "embedded" | "used_in_comparison" | "used_in_report",
  eventDetail: Record<string, unknown>,
  actor: string
) {
  await db.assetAuditLog.create({
    data: { mediaAssetId, eventType, eventDetail, actor },
  });
}
```
Call sites to add retroactively:
```typescript
// after MediaAsset creation (Phase 1 route)
await logEvent(asset.id, "uploaded", { format: asset.format }, asset.uploadedBy);

// after AI tagging completes (Phase 2 flow)
await logEvent(assetId, "ai_tagged", { tags: tags.map(t => t.label), confidences: tags.map(t => t.confidence) }, "system-ai");

// after embedding generation (Phase 3 flow)
await logEvent(assetId, "embedded", { model: "text-embedding-3-small" }, "system-ai");

// after comparison creation (Phase 3 flow)
await logEvent(beforeAssetId, "used_in_comparison", { comparisonId }, createdBy);
await logEvent(afterAssetId, "used_in_comparison", { comparisonId }, createdBy);
```

### 4.3 Fact Assembly — NO AI (`lib/reports/factAssembly.ts`)
```typescript
import { db } from "@/lib/db";

export async function assembleProjectFacts(projectId: string) {
  const assets = await db.mediaAsset.findMany({ where: { projectId } });
  const comparisons = await db.comparison.findMany({ where: { projectId } });
  const categories = await db.mediaAssetCategory.findMany({
    where: { mediaAsset: { projectId } },
    include: { category: true },
  });

  const categoryBreakdown: Record<string, number> = {};
  for (const c of categories) {
    categoryBreakdown[c.category.name] = (categoryBreakdown[c.category.name] ?? 0) + 1;
  }

  const dates = assets.map(a => a.capturedAt).filter(Boolean) as Date[];
  const dateRange = dates.length
    ? { from: new Date(Math.min(...dates.map(d => d.getTime()))), to: new Date(Math.max(...dates.map(d => d.getTime()))) }
    : null;

  return {
    totalAssets: assets.length,
    categoryBreakdown,
    dateRange,
    comparisons: comparisons.map(c => ({ id: c.id, notes: c.notes })),
    notes: assets.map(a => a.manualNotes).filter(Boolean),
  };
}
```

### 4.4 Grounded Narrative Generation (`lib/reports/narrativeGen.ts`)
```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateNarrative(facts: Awaited<ReturnType<typeof import("./factAssembly").assembleProjectFacts>>) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You write concise sustainability impact-report narratives. " +
          "Use ONLY the facts provided in the user message. " +
          "Never invent statistics, dates, or details not present in the facts. " +
          "Write 2-3 paragraphs suitable for a stakeholder report.",
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
  });
  return completion.choices[0].message.content ?? "";
}
```

### 4.5 PDF Export (`lib/reports/pdfExport.ts`)
```typescript
import puppeteer from "puppeteer";

export async function renderReportPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  return pdf;
}
```

## 5. Exit Criteria & Verification Tests

```bash
# 1. Migrate
npx prisma migrate dev --name add_reports_and_audit

# 2. Verify impact-stats is real, non-AI data
curl http://localhost:3000/api/projects/<project_id>/impact-stats
# Verify: totalAssets, categoryBreakdown, dateRange, comparisons all match
# what's actually in the DB (spot check against Prisma Studio)

# 3. Generate a report
curl -X POST http://localhost:3000/api/projects/<project_id>/reports \
  -H "Content-Type: application/json" -d '{}'
# Verify: generatedSummary text only references categories/counts/dates
# that actually exist for this project — no invented numbers

# 4. Edit and export
curl -X PATCH http://localhost:3000/api/reports/<report_id> \
  -H "Content-Type: application/json" \
  -d '{"generatedSummary": "edited text here"}'
curl http://localhost:3000/api/reports/<report_id>/export --output report.pdf
# Verify: report.pdf opens and contains the edited narrative + images

# 5. Check traceability
curl http://localhost:3000/api/assets/<asset_id>/audit-log
# Verify: entries appear in order — uploaded, ai_tagged, embedded,
# (used_in_comparison if applicable), used_in_report

# 6. Dashboard sanity check
# Open /projects/<id>/dashboard in the browser
# Verify: category chart renders, counts match impact-stats response
```

## 6. Final Readiness Checklist (whole product)

- [ ] Full flow works end to end: create project → upload → AI auto-tags → semantic search → before/after comparison → generate + export report → trace any asset's full history
- [ ] LLM narrative never contains a number/date/name absent from `impact-stats`
- [ ] PDF export opens correctly and includes at least one before/after image pair
- [ ] Every asset in the demo project shows a complete, correctly-ordered audit timeline
- [ ] Dashboard chart matches the underlying data exactly
