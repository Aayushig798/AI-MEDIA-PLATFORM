# AI-Powered Impact & Sustainability Media Platform

`License: MIT` `Next.js 14` `TypeScript` `Cloudinary` `PostgreSQL + pgvector` `OpenAI`

An AI-powered media intelligence platform, built on Cloudinary, that turns raw field photos and videos from NGOs, governments, and sustainability organizations into organized evidence, searchable knowledge, and reliable impact reports.

## Why this project?

NGOs, governments, and sustainability organizations generate huge volumes of photos and videos from field projects — environmental initiatives, infrastructure work, community programs. Manually organizing, tagging, verifying, and turning this raw media into usable evidence and reports doesn't scale: a field team ends up with thousands of untagged files scattered across folders, with no reliable way to prove what changed, when, or where.

This platform solves that with four connected capabilities:

- **Structured Media Storage:** Every asset lives inside a Project, tagged by location, date, and category, delivered through Cloudinary's CDN.
- **Automatic Media Understanding:** AI tagging identifies objects, scenes, and activity types the moment media is uploaded — no manual tagging required.
- **Semantic Search & Visual Comparison:** Natural-language search finds relevant evidence even without exact tag matches, and before/after sliders make visible change undeniable.
- **Grounded Impact Reporting:** An LLM drafts narrative reports from real project statistics — never invented ones — exportable as PDF, with a full traceability trail back to the original source file.

## How it works

**1. Upload & Auto-Tagging Flow**

When a field asset is uploaded, it passes through an automated understanding pipeline before it's fully indexed:

```
Upload (signed, direct to Cloudinary)
   → Cloudinary AI add-on / fallback Vision API tags the asset
   → Raw labels mapped to a domain category
   → Text embedding generated from tags + category + location
   → Asset becomes searchable and comparison-eligible
```

**2. Evidence-to-Report Flow**

Once a project has enough tagged, embedded, and compared assets, its evidence can be turned into a stakeholder-ready report:

```
Select project → assemble structured facts (counts, categories, comparisons)
   → LLM drafts a narrative strictly grounded in those facts
   → user edits the draft
   → exported as PDF with images sourced live from Cloudinary
```

## Core Features

- **Signed Direct-to-Cloudinary Uploads:** Images and videos upload straight from the browser to Cloudinary using short-lived signed parameters — the API secret never reaches the client.
- **Automatic AI Tagging & Categorization:** Cloudinary's AI add-ons (or a Vision API fallback) label every asset on upload; labels are mapped into a fixed set of domain categories (Environmental, Infrastructure, Community, Disaster Response) with confidence scores stored per tag.
- **Hybrid Semantic Search:** Combines OpenAI text embeddings with `pgvector` cosine-similarity search, so a query like *"riverbank erosion damage"* returns relevant results even when no asset is tagged with that exact phrase — filterable by project, category, and date range.
- **Before/After Evidence Comparison:** Auto-suggests candidate pairs by grouping assets on project + location + date, then renders confirmed pairs in a synced slider using matched Cloudinary transformations.
- **Grounded Report Generation:** Structured facts are computed first, with no AI involved; only then is an LLM asked to narrate those facts — eliminating hallucinated statistics in stakeholder reports.
- **Full Traceability:** Every asset carries an audit trail — uploaded → AI-tagged → embedded → used in comparison(s) → used in report(s) — each entry stamped with an actor and timestamp.
- **PDF Export:** Finished reports render to a polished, shareable PDF via Puppeteer, pulling images directly from Cloudinary's CDN.

## Quickstart

### Prerequisites
- Node.js 18+ & npm
- A PostgreSQL database with the `pgvector` extension available (Neon and Supabase both support this out of the box)
- A Cloudinary account (cloud name, API key, API secret)
- An OpenAI API key (needed from the search/reporting phases onward)

### 1. Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd ai-media-platform

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# fill in DATABASE_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
# CLOUDINARY_API_SECRET, OPENAI_API_KEY, NEXTAUTH_SECRET

# Run database migrations
npx prisma migrate dev
```

### 2. Start the app
```bash
npm run dev
```
Opens the dashboard at `http://localhost:3000`.

### 3. Verify the pipeline end to end
Create a project, upload a batch of test photos, and confirm: thumbnails render from Cloudinary, AI tags appear within seconds, a search query surfaces them semantically, and a generated report references only real project data.

## API Usage & Examples

### Uploading media (signed, direct to Cloudinary)
```bash
# 1. Request a signature for the target project
curl -X POST http://localhost:3000/api/cloudinary/sign \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_river_cleanup_01"}'
```
```json
{
  "signature": "a1b2c3d4e5f6...",
  "timestamp": 1735689600,
  "folder": "impact-platform/proj_river_cleanup_01",
  "api_key": "123456789012345",
  "cloud_name": "your-cloud-name"
}
```
```bash
# 2. After the frontend uploads directly to Cloudinary with these params,
#    persist the returned metadata as a MediaAsset
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_river_cleanup_01",
    "cloudinaryPublicId": "impact-platform/proj_river_cleanup_01/8f2a91",
    "secureUrl": "https://res.cloudinary.com/your-cloud/image/upload/v1/impact-platform/...",
    "resourceType": "image",
    "manualCategory": "Environmental",
    "manualLocation": "Sector 4, Riverbank"
  }'
```

### Checking AI tags on an asset
```bash
curl http://localhost:3000/api/assets/<asset_id>/ai-tags
```
```json
{
  "tags": [
    { "label": "flood", "confidence": 0.93, "source": "cloudinary_google" },
    { "label": "debris", "confidence": 0.81, "source": "cloudinary_google" }
  ],
  "category": "Environmental",
  "aiProcessingStatus": "done"
}
```

### Natural-language semantic search
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "riverbank erosion damage", "projectId": "proj_river_cleanup_01"}'
```
```json
{
  "results": [
    {
      "id": "asset_8f2a91",
      "secureUrl": "https://res.cloudinary.com/.../image/upload/...",
      "aiCategory": "Environmental",
      "distance": 0.184
    }
  ],
  "total": 1
}
```

### Generating a grounded impact report
```bash
curl -X POST http://localhost:3000/api/projects/proj_river_cleanup_01/reports \
  -H "Content-Type: application/json" -d '{}'
```
```json
{
  "reportId": "rep_9a41",
  "generatedSummary": "Over the tracked period, the River Cleanup project documented 42 assets across 3 categories, with 5 before/after comparisons showing visible debris reduction along Sector 4...",
  "selectedAssetIds": ["asset_8f2a91", "asset_7c11de"]
}
```

### Auditing an asset's full traceability
```bash
curl http://localhost:3000/api/assets/<asset_id>/audit-log
```
```json
{
  "timeline": [
    { "eventType": "uploaded", "actor": "user_priya", "createdAt": "2026-06-01T10:02:00Z" },
    { "eventType": "ai_tagged", "eventDetail": { "tags": ["flood", "debris"] }, "actor": "system-ai", "createdAt": "2026-06-01T10:02:04Z" },
    { "eventType": "embedded", "actor": "system-ai", "createdAt": "2026-06-01T10:02:06Z" },
    { "eventType": "used_in_comparison", "eventDetail": { "comparisonId": "comp_31" }, "actor": "user_priya", "createdAt": "2026-06-02T09:15:00Z" },
    { "eventType": "used_in_report", "eventDetail": { "reportId": "rep_9a41" }, "actor": "user_priya", "createdAt": "2026-06-03T11:40:00Z" }
  ]
}
```

## API Summary

| Method | Path | Description |
|---|---|---|
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/[id]` | Get project details + its assets |
| POST | `/api/cloudinary/sign` | Get signed params for a direct upload |
| POST | `/api/assets` | Persist a media asset record after upload |
| GET | `/api/assets` | List/filter assets (project, category, aiCategory, date range) |
| PATCH | `/api/assets/[id]` | Edit manual metadata |
| DELETE | `/api/assets/[id]` | Delete asset (Cloudinary + DB) |
| POST | `/api/assets/[id]/analyze` | Manually re-trigger AI tagging |
| GET | `/api/assets/[id]/ai-tags` | List AI tags + confidence for an asset |
| DELETE | `/api/assets/[id]/ai-tags/[tagId]` | Reject an incorrect AI tag |
| POST | `/api/search` | Natural-language + filtered semantic search |
| GET | `/api/projects/[id]/suggested-comparisons` | Auto-suggested before/after pairs |
| POST | `/api/comparisons` | Save a confirmed before/after pair |
| GET | `/api/comparisons` | List saved comparisons for a project |
| GET | `/api/projects/[id]/impact-stats` | Structured project facts (no AI) |
| POST | `/api/projects/[id]/reports` | Generate a grounded LLM report draft |
| PATCH | `/api/reports/[id]` | Edit a report's narrative |
| GET | `/api/reports/[id]/export` | Export a report as PDF |
| GET | `/api/assets/[id]/audit-log` | Full traceability timeline for an asset |

## Build Roadmap

This project is built in four sequential phases, each documented in the [`docs/`](./docs) directory:

- [x] [**Phase 1 — Foundation & Media Management**](./docs/PHASE1_FOUNDATION_AND_MEDIA_MANAGEMENT.md): projects, signed Cloudinary uploads, gallery, manual tags. *(Implemented & Active)*
- [ ] [**Phase 2 — AI Understanding & Auto-Organization**](./docs/PHASE2_AI_UNDERSTANDING_AND_AUTO_ORGANIZATION.md): automatic tagging + domain categorization.
- [ ] [**Phase 3 — Intelligent Search & Evidence Comparison**](./docs/PHASE3_INTELLIGENT_SEARCH_AND_EVIDENCE_COMPARISON.md): semantic search + before/after slider.
- [ ] [**Phase 4 — Impact Intelligence & Reporting**](./docs/PHASE4_IMPACT_REPORTING.md): grounded LLM reports, PDF export, full traceability, dashboard.

## Project Structure

```
ai-media-platform/
├── docs/                       # Detailed specifications for Phases 1–4
├── prisma/
│   ├── schema.prisma           # User, Project, MediaAsset, AiTag, Category,
│   │                           #   MediaEmbedding, Comparison, Report, AssetAuditLog
│   └── migrations/
├── lib/
│   ├── db.ts                   # Prisma client singleton
│   ├── cloudinary.ts           # Signed upload params + destroy helper
│   ├── ai/
│   │   ├── categoryMapping.ts  # Raw label -> domain category
│   │   ├── visionFallback.ts   # External Vision API fallback tagging
│   │   ├── embeddings.ts       # OpenAI embedding generation
│   │   └── captioning.ts       # Optional GPT-4o-mini vision captioning
│   ├── search/
│   │   ├── vectorSearch.ts     # pgvector cosine-similarity query
│   │   └── pairing.ts          # Before/after candidate grouping
│   ├── reports/
│   │   ├── factAssembly.ts     # Structured facts — no AI
│   │   ├── narrativeGen.ts     # Grounded LLM narrative generation
│   │   └── pdfExport.ts        # Puppeteer HTML -> PDF
│   └── audit/
│       └── logEvent.ts         # Traceability log helper
├── app/
│   ├── api/                    # All route handlers (see API Summary above)
│   ├── projects/               # Project list, gallery, dashboard, report builder pages
│   ├── search/                 # Global semantic search page
│   └── components/             # UploadModal, GalleryGrid, FilterBar, AiTagChips,
│                                #   CompareSlider, ReportBuilder, TraceabilityTimeline,
│                                #   ImpactCharts
└── .env.example
```

## Configuration

Environment variables go in `.env.local` (see `.env.example` for the full template):

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# AI
OPENAI_API_KEY=sk-...
GOOGLE_VISION_API_KEY=...        # only needed if the Cloudinary AI add-on is unavailable

# Auth
NEXTAUTH_SECRET=generate-a-random-string
```

## License

This project is licensed under the MIT License.
