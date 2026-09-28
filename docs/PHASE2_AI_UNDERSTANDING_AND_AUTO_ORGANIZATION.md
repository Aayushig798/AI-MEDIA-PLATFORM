# Phase 2: AI Understanding & Auto-Organization (Day 3–4)

**Timeline:** Day 3–4
**Goal:** Every uploaded asset is automatically analyzed — objects/scenes tagged, mapped into a domain category — with zero manual tagging required.
**Exit Criterion:** Uploading a new photo produces AI tags + a domain category within a few seconds, visible in the UI with confidence scores, and the gallery can be filtered by AI-assigned category.
**Focus:** Classification AI only (Cloudinary add-on or fallback vision API). No search, no comparison, no generation yet.

## 1. Requirements Covered

| ID | Type | Description | Priority |
|---|---|---|---|
| FR-08 | Functional | Automatically trigger AI tagging on every upload (Cloudinary add-on primary, external Vision API fallback). | Must |
| FR-09 | Functional | Store AI labels + confidence scores, distinct from manual tags. | Must |
| FR-10 | Functional | Map raw AI labels to a fixed set of domain categories via keyword mapping. | Must |
| FR-11 | Functional | Extract & store EXIF GPS + capture date when present. | Should |
| FR-12 | Functional | Allow a user to reject/remove an individual AI tag. | Must |
| FR-13 | Functional | Add an AI-category filter to the existing gallery filter bar. | Must |
| NFR-05 | Non-Functional | AI processing must not block the upload response (async/fire-and-forget). | Must |
| NFR-06 | Non-Functional | A manual "re-analyze" action must exist for failed AI processing. | Should |

## 2. Directory & File Structure (Phase 2 additions)

```
ai-media-platform/
├── lib/
│   ├── ai/
│   │   ├── cloudinaryTagging.ts     # Reads inline categorization/auto_tagging from upload response
│   │   ├── visionFallback.ts        # Calls Google Vision / AWS Rekognition if no add-on enabled
│   │   └── categoryMapping.ts       # Keyword -> domain category lookup table
├── app/
│   ├── api/
│   │   └── assets/
│   │       └── [id]/
│   │           ├── analyze/route.ts       # POST manual re-trigger
│   │           └── ai-tags/
│   │               ├── route.ts           # GET list AI tags
│   │               └── [tagId]/route.ts   # DELETE reject a tag
│   └── components/
│       ├── AiTagChips.tsx
│       └── AiCategoryFilter.tsx
```

## 3. Step-by-Step Implementation Tasks

- [ ] **Task 2.1: Extend Prisma Schema**
  Add `AiTag`, `Category`, `MediaAssetCategory` models. Add `exifLat`, `exifLng`, `aiProcessingStatus` (default `"pending"`) to `MediaAsset`. Run a new migration — do not drop existing data.
- [ ] **Task 2.2: Enable Cloudinary AI Add-on on Upload**
  Extend the Phase 1 signed-upload params with `categorization`, `auto_tagging: 0.6`, `image_metadata: true`.
- [ ] **Task 2.3: Read Inline Tagging Results**
  On the `POST /api/assets` handler, check `info.categorization` / `info.auto_tagging` from Cloudinary's response; if present, write `AiTag` rows immediately and set `aiProcessingStatus = "done"`.
- [ ] **Task 2.4: Vision API Fallback**
  If no add-on data is present, asynchronously call Google Vision `LABEL_DETECTION` (or AWS Rekognition `DetectLabels`) against `secureUrl`, write `AiTag` rows when it resolves, update `aiProcessingStatus`.
- [ ] **Task 2.5: Category Mapping**
  Build `lib/ai/categoryMapping.ts` — keyword → category lookup (`Environmental`, `Infrastructure`, `Community`, `Disaster Response`, `Uncategorized` fallback). Write matches into `MediaAssetCategory`.
- [ ] **Task 2.6: Manual Re-analyze + Reject Tag Endpoints**
  `POST /api/assets/[id]/analyze` re-runs Task 2.3/2.4 on demand. `DELETE /api/assets/[id]/ai-tags/[tagId]` removes a single incorrect tag.
- [ ] **Task 2.7: Frontend — AI Badges + Filter**
  `AiTagChips.tsx` shows label + confidence % with a reject "x". Gallery thumbnails show a pending/done AI badge. `AiCategoryFilter.tsx` adds an `aiCategory` dropdown to the existing filter bar.

## 4. Code Specifications

### 4.1 Prisma Schema Additions
```prisma
model AiTag {
  id           String     @id @default(cuid())
  mediaAssetId String
  mediaAsset   MediaAsset @relation(fields: [mediaAssetId], references: [id])
  label        String
  confidence   Float
  source       String     // "cloudinary_google" | "cloudinary_rekognition" | "external_vision"
  createdAt    DateTime   @default(now())
}

model Category {
  id   String @id @default(cuid())
  name String @unique
}

model MediaAssetCategory {
  id           String     @id @default(cuid())
  mediaAssetId String
  mediaAsset   MediaAsset @relation(fields: [mediaAssetId], references: [id])
  categoryId   String
  category     Category   @relation(fields: [categoryId], references: [id])
}

// Additions to MediaAsset:
//   exifLat            Float?
//   exifLng             Float?
//   aiProcessingStatus  String  @default("pending")
```

### 4.2 Category Mapping (`lib/ai/categoryMapping.ts`)
```typescript
const KEYWORD_MAP: Record<string, string> = {
  river: "Environmental", flood: "Environmental", forest: "Environmental",
  water: "Environmental", tree: "Environmental", solar: "Environmental",
  scaffolding: "Infrastructure", construction: "Infrastructure", road: "Infrastructure",
  building: "Infrastructure", bridge: "Infrastructure",
  crowd: "Community", meeting: "Community", school: "Community", people: "Community",
  debris: "Disaster Response", rubble: "Disaster Response", rescue: "Disaster Response",
};

export function mapLabelToCategory(label: string): string {
  const key = label.toLowerCase();
  for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
    if (key.includes(keyword)) return category;
  }
  return "Uncategorized";
}
```

### 4.3 Upload-Time Signed Params with AI Add-on (extends `lib/cloudinary.ts`)
```typescript
export function getSignedUploadParams(projectId: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `impact-platform/${projectId}`;
  const paramsToSign = {
    timestamp,
    folder,
    categorization: "google_tagging",
    auto_tagging: 0.6,
    image_metadata: true,
  };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );
  return { ...paramsToSign, signature, api_key: process.env.CLOUDINARY_API_KEY, cloud_name: process.env.CLOUDINARY_CLOUD_NAME };
}
```

### 4.4 Fallback Vision Call (`lib/ai/visionFallback.ts`)
```typescript
import { db } from "@/lib/db";
import { mapLabelToCategory } from "./categoryMapping";

export async function runVisionFallback(assetId: string, imageUrl: string) {
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [{ image: { source: { imageUri: imageUrl } }, features: [{ type: "LABEL_DETECTION", maxResults: 10 }] }],
      }),
    }
  );
  const data = await res.json();
  const labels = data.responses?.[0]?.labelAnnotations ?? [];

  for (const l of labels) {
    await db.aiTag.create({
      data: { mediaAssetId: assetId, label: l.description, confidence: l.score, source: "external_vision" },
    });
    const category = mapLabelToCategory(l.description);
    const cat = await db.category.upsert({ where: { name: category }, update: {}, create: { name: category } });
    await db.mediaAssetCategory.create({ data: { mediaAssetId: assetId, categoryId: cat.id } });
  }

  await db.mediaAsset.update({ where: { id: assetId }, data: { aiProcessingStatus: "done" } });
}
```

## 5. Exit Criteria & Verification Tests

```bash
# 1. Apply the new migration
npx prisma migrate dev --name add_ai_tags

# 2. Upload a test image with an obvious subject (e.g. a flooded street photo)
# via the UI, then check processing status:
curl http://localhost:3000/api/assets/<asset_id>/ai-tags
# Verify: at least one label with a confidence score, source field populated

# 3. Confirm category mapping worked
npx prisma studio
# Check MediaAssetCategory table has a row linking the asset to a Category

# 4. Test manual re-analyze
curl -X POST http://localhost:3000/api/assets/<asset_id>/analyze
# Verify: aiProcessingStatus flips to "done" again, tags refresh

# 5. Test tag rejection
curl -X DELETE http://localhost:3000/api/assets/<asset_id>/ai-tags/<tag_id>
# Verify: tag disappears from GET /api/assets/<asset_id>/ai-tags

# 6. Test AI-category filter
curl "http://localhost:3000/api/assets?aiCategory=Environmental"
# Verify: only assets mapped to that category are returned
```

## 6. Readiness for Phase 3 Checklist

- [ ] Every newly uploaded asset reaches `aiProcessingStatus = "done"` within a few seconds
- [ ] `AiTag` rows include confidence scores and correct `source`
- [ ] At least 4 domain categories are correctly auto-assigned across varied test images
- [ ] Rejecting a tag works and reflects immediately in the UI
- [ ] AI-category filter narrows the gallery correctly
- [ ] `MediaAsset.exifLat` / `exifLng` populated when present in source files (needed for Phase 3 pairing logic)
