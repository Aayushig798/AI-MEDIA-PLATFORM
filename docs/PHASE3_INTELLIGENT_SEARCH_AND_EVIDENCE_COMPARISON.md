# Phase 3: Intelligent Search & Evidence Comparison (Day 5–6)

**Timeline:** Day 5–6
**Goal:** Users can search media using natural language, and compare before/after pairs of the same location/project across time.
**Exit Criterion:** A natural-language query (e.g. "riverbank erosion damage") returns relevant results even without an exact tag match, and at least one before/after pair can be viewed in a synced slider and saved.
**Focus:** Retrieval AI (embeddings + vector search) and comparison UI. No report generation or audit trail yet.

## 1. Requirements Covered

| ID | Type | Description | Priority |
|---|---|---|---|
| FR-14 | Functional | Generate a text embedding per asset from its AI tags + category + location. | Must |
| FR-15 | Functional | Natural-language search bar with vector similarity ranking. | Must |
| FR-16 | Functional | Hybrid search — combine vector similarity with structured filters (project, category, date). | Must |
| FR-17 | Functional | Auto-suggest before/after pairs by project + location proximity + date. | Must |
| FR-18 | Functional | Manual before/after pairing with a synced comparison slider. | Must |
| FR-19 | Functional | Persist confirmed pairs as `Comparison` records. | Must |
| NFR-07 | Non-Functional | Vector search runs on the same Postgres instance via `pgvector` — no separate vector DB. | Target |
| NFR-08 | Non-Functional | Slider images normalized to identical crop/aspect ratio via Cloudinary transforms. | Should |

## 2. Directory & File Structure (Phase 3 additions)

```
ai-media-platform/
├── lib/
│   ├── ai/
│   │   ├── embeddings.ts           # Builds text summary + calls OpenAI embeddings
│   │   └── captioning.ts           # Optional GPT-4o-mini vision captioning
│   └── search/
│       ├── vectorSearch.ts         # pgvector cosine-similarity query
│       └── pairing.ts              # Groups assets by project+location+date
├── prisma/
│   └── migrations/
│       └── xxxx_enable_pgvector/migration.sql
├── app/
│   ├── api/
│   │   ├── search/route.ts                              # POST natural-language search
│   │   ├── projects/[id]/suggested-comparisons/route.ts  # GET suggested pairs
│   │   └── comparisons/
│   │       ├── route.ts             # POST save, GET list by project
│   ├── search/page.tsx                                   # Global search UI
│   └── components/
│       ├── CompareSlider.tsx        # react-compare-slider wrapper
│       └── SuggestedComparisons.tsx
```

## 3. Step-by-Step Implementation Tasks

- [ ] **Task 3.1: Enable pgvector**
  Raw SQL migration: `CREATE EXTENSION IF NOT EXISTS vector;`. Add `MediaEmbedding` model with `Unsupported("vector(1536)")`, then a follow-up `ALTER TABLE` to actually add the vector column (Prisma can't type it natively).
- [ ] **Task 3.2: Embedding Generation Hook**
  When `aiProcessingStatus` flips to `"done"` (Phase 2), automatically build a text summary and call OpenAI `text-embedding-3-small`; store the vector in `MediaEmbedding`.
- [ ] **Task 3.3 (optional): Auto-Captioning**
  Before embedding, call GPT-4o-mini vision on `secureUrl` to generate a one-sentence caption; fold it into the embedded text for better recall.
- [ ] **Task 3.4: Search Endpoint**
  `POST /api/search` embeds the incoming query the same way, runs a `$queryRaw` cosine-distance (`<=>`) query against `MediaEmbedding`, joined with any structured filters.
- [ ] **Task 3.5: Comparison Model**
  Add `Comparison` model (`projectId`, `beforeAssetId`, `afterAssetId`, `notes`, `createdBy`).
- [ ] **Task 3.6: Pairing Suggestion Service**
  `lib/search/pairing.ts` groups `MediaAsset` rows by `projectId` + location proximity (`exifLat`/`exifLng` within a small threshold, or `manualLocation` string match fallback), sorts by `capturedAt`, returns earliest+latest per group.
- [ ] **Task 3.7: Comparison API + UI**
  `POST /api/comparisons` persists a confirmed pair; `GET /api/comparisons?projectId=` lists them. `CompareSlider.tsx` renders both images via matched Cloudinary transform URLs.

## 4. Code Specifications

### 4.1 pgvector Migration (raw SQL)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "MediaEmbedding" ADD COLUMN embedding vector(1536);
CREATE INDEX ON "MediaEmbedding" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 4.2 Prisma Additions
```prisma
model MediaEmbedding {
  id           String     @id @default(cuid())
  mediaAssetId String     @unique
  mediaAsset   MediaAsset @relation(fields: [mediaAssetId], references: [id])
  embedding    Unsupported("vector(1536)")
  modelVersion String
  createdAt    DateTime   @default(now())
}

model Comparison {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])
  beforeAssetId String
  afterAssetId  String
  notes         String?
  createdBy     String
  createdAt     DateTime @default(now())
}
```

### 4.3 Embedding Generation (`lib/ai/embeddings.ts`)
```typescript
import OpenAI from "openai";
import { db } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbeddingForAsset(assetId: string) {
  const asset = await db.mediaAsset.findUnique({
    where: { id: assetId },
    include: { /* include AI tags + category via your relations */ },
  });
  if (!asset) return;

  const tags = await db.aiTag.findMany({ where: { mediaAssetId: assetId } });
  const text = `${asset.manualCategory ?? ""}. Tags: ${tags.map(t => t.label).join(", ")}. Location: ${asset.manualLocation ?? ""}. Notes: ${asset.manualNotes ?? ""}.`;

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const vector = response.data[0].embedding;

  await db.$executeRawUnsafe(
    `INSERT INTO "MediaEmbedding" (id, "mediaAssetId", embedding, "modelVersion", "createdAt")
     VALUES (gen_random_uuid(), $1, $2::vector, 'text-embedding-3-small', now())
     ON CONFLICT ("mediaAssetId") DO UPDATE SET embedding = $2::vector`,
    assetId,
    `[${vector.join(",")}]`
  );
}
```

### 4.4 Vector Search Query (`lib/search/vectorSearch.ts`)
```typescript
import { db } from "@/lib/db";
import { embedQueryText } from "./embedQuery";

export async function searchAssets(query: string, filters: { projectId?: string; category?: string }) {
  const queryVector = await embedQueryText(query);

  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT ma.*, me.embedding <=> $1::vector AS distance
     FROM "MediaEmbedding" me
     JOIN "MediaAsset" ma ON ma.id = me."mediaAssetId"
     WHERE ($2::text IS NULL OR ma."projectId" = $2)
     ORDER BY distance ASC
     LIMIT 20`,
    `[${queryVector.join(",")}]`,
    filters.projectId ?? null
  );
  return rows;
}
```

### 4.5 Pairing Logic (`lib/search/pairing.ts`)
```typescript
import { db } from "@/lib/db";

const LOCATION_THRESHOLD_DEG = 0.01; // roughly ~1km

export async function suggestComparisons(projectId: string) {
  const assets = await db.mediaAsset.findMany({
    where: { projectId, capturedAt: { not: null } },
    orderBy: { capturedAt: "asc" },
  });

  const groups: typeof assets[] = [];
  for (const asset of assets) {
    const group = groups.find(g =>
      g[0].manualLocation === asset.manualLocation ||
      (asset.exifLat && g[0].exifLat &&
        Math.abs(asset.exifLat - g[0].exifLat) < LOCATION_THRESHOLD_DEG)
    );
    if (group) group.push(asset); else groups.push([asset]);
  }

  return groups
    .filter(g => g.length >= 2)
    .map(g => ({ before: g[0], after: g[g.length - 1] }));
}
```

## 5. Exit Criteria & Verification Tests

```bash
# 1. Enable pgvector and migrate
npx prisma migrate dev --name enable_pgvector

# 2. Verify embeddings are generated automatically
# Upload a new asset, wait for AI tagging (Phase 2) to finish, then:
npx prisma studio
# Check MediaEmbedding has a row for that asset

# 3. Test natural-language search
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "riverbank erosion damage"}'
# Verify: results returned even if no asset has that literal phrase as a tag

# 4. Test hybrid filtering
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "flood", "projectId": "<project_id>"}'
# Verify: only assets from that project are returned

# 5. Test suggested comparisons
curl http://localhost:3000/api/projects/<project_id>/suggested-comparisons
# Verify: returns at least one before/after pair for a project with 2+
# dated assets at the same location

# 6. Save and reload a comparison
curl -X POST http://localhost:3000/api/comparisons \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<id>","beforeAssetId":"<id1>","afterAssetId":"<id2>"}'
curl "http://localhost:3000/api/comparisons?projectId=<project_id>"
# Verify: the saved comparison is returned
```

## 6. Readiness for Phase 4 Checklist

- [ ] Every AI-tagged asset automatically gets a `MediaEmbedding` row
- [ ] Natural-language search returns semantically relevant results, not just exact matches
- [ ] Search + structured filters combine correctly
- [ ] At least one auto-suggested and one manually-saved comparison exist and persist
- [ ] Comparison slider renders both images with matched framing via Cloudinary transforms
- [ ] `Comparison` and `MediaEmbedding` tables are populated — needed as input facts for Phase 4's report generation
