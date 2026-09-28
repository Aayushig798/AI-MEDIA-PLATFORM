# Phase 1: Foundation & Media Management (Day 1–2)

**Timeline:** Day 1–2 
**Goal:** A team can create a project and upload photos/videos into it, organized by project/location/date, with a working gallery — fully CRUD, no AI yet.
**Exit Criterion:** A batch of 5+ mixed image/video files uploads successfully, appears correctly in a filterable gallery served from Cloudinary, and deleting an asset removes it from both the gallery and the Cloudinary Media Library.
**Focus:** No AI, no search, no comparison, no reporting yet. Categories/tags are assigned manually.

## 1. Requirements Covered

| ID | Type | Description | Priority |
|---|---|---|---|
| FR-01 | Functional | Create a Project (name, description, location, start date). | Must |
| FR-02 | Functional | Signed direct-to-Cloudinary upload of images/videos into a project. | Must |
| FR-03 | Functional | Manual tagging on upload (category, location override, notes). | Must |
| FR-04 | Functional | Gallery view per project — grid, newest first, thumbnails via Cloudinary transformation. | Must |
| FR-05 | Functional | Filter gallery by manual category and date range. | Must |
| FR-06 | Functional | Edit manual metadata on an existing asset. | Must |
| FR-07 | Functional | Delete an asset — must remove from Cloudinary **and** DB, not just one. | Must |
| NFR-01 | Non-Functional | Cloudinary API secret never reaches the browser (signed uploads only). | Must |
| NFR-02 | Non-Functional | No orphaned Cloudinary assets — delete DB row only if Cloudinary `destroy` succeeds. | Target |

## 2. Directory & File Structure (Phase 1 Target)

```
ai-media-platform/
├── .env.example
├── package.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── lib/
│   ├── db.ts                    # Prisma client singleton
│   └── cloudinary.ts            # Signature generation + destroy helper
├── app/
│   ├── api/
│   │   ├── projects/
│   │   │   ├── route.ts         # POST create, GET list
│   │   │   └── [id]/route.ts    # GET project + its assets
│   │   ├── cloudinary/
│   │   │   └── sign/route.ts    # POST signed upload params
│   │   └── assets/
│   │       ├── route.ts         # POST create asset record, GET filtered list
│   │       └── [id]/route.ts    # PATCH edit metadata, DELETE (Cloudinary + DB)
│   ├── projects/
│   │   ├── page.tsx             # Project list + "New Project" modal
│   │   └── [id]/page.tsx        # Gallery + upload modal + filter bar
│   └── components/
│       ├── UploadModal.tsx
│       ├── GalleryGrid.tsx
│       ├── FilterBar.tsx
│       └── AssetDetailModal.tsx
```

## 3. Step-by-Step Implementation Tasks

- [x] **Task 1.1: Project Setup**
  Initialize Next.js 14 (App Router) + TypeScript + Tailwind. Install `prisma`, `@prisma/client`, `cloudinary`, `next-auth` (or skip auth for a single seeded demo user).
- [x] **Task 1.2: Database & Prisma Schema**
  Define `User`, `Project`, `MediaAsset` models. Run `npx prisma migrate dev --name init`.
- [x] **Task 1.3: Cloudinary Signature Endpoint**
  `lib/cloudinary.ts` wraps the Cloudinary Node SDK; `app/api/cloudinary/sign/route.ts` returns `{ signature, timestamp, api_key, cloud_name, folder }` for a given `projectId`. Secret stays server-side only.
- [x] **Task 1.4: Direct Upload Flow**
  Frontend requests a signature, then `POST`s the file directly to `https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload` with `resource_type=auto` and folder `impact-platform/{projectId}/{uuid}`.
- [x] **Task 1.5: Persist Asset Record**
  On upload success, `POST /api/assets` with Cloudinary's returned `public_id`, `secure_url`, `resource_type`, `format`, `bytes`, `width`, `height` + manual tags → creates a `MediaAsset` row.
- [x] **Task 1.6: Gallery + Filters**
  `GalleryGrid.tsx` renders thumbnails via Cloudinary transformation URL (`c_thumb,w_300,h_300,g_auto`) — never store a separate thumbnail file. `FilterBar.tsx` filters by category + date range via `GET /api/assets?projectId=&category=&from=&to=`.
- [x] **Task 1.7: Edit & Delete**
  `PATCH /api/assets/[id]` updates manual metadata. `DELETE /api/assets/[id]` calls Cloudinary's `destroy(public_id)` **first**; only deletes the DB row if that succeeds.

## 4. Code Specifications

### 4.1 Prisma Schema (`prisma/schema.prisma`)
```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  password  String
  createdAt DateTime  @default(now())
  projects  Project[]
}

model Project {
  id          String       @id @default(cuid())
  name        String
  description String?
  location    String?
  startDate   DateTime?
  createdBy   String
  user        User         @relation(fields: [createdBy], references: [id])
  createdAt   DateTime     @default(now())
  assets      MediaAsset[]
}

model MediaAsset {
  id                 String    @id @default(cuid())
  projectId          String
  project            Project   @relation(fields: [projectId], references: [id])
  cloudinaryPublicId String    @unique
  secureUrl          String
  resourceType       String    // "image" | "video"
  format             String
  bytes              Int
  width              Int?
  height             Int?
  manualCategory     String?
  manualLocation     String?
  manualNotes        String?
  capturedAt         DateTime?
  uploadedBy         String
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

### 4.2 Cloudinary Helper (`lib/cloudinary.ts`)
```typescript
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function getSignedUploadParams(projectId: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `impact-platform/${projectId}`;
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET!
  );
  return {
    signature,
    timestamp,
    folder,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export async function destroyAsset(publicId: string, resourceType: string) {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
```

### 4.3 Sign Route (`app/api/cloudinary/sign/route.ts`)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSignedUploadParams } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const { projectId } = await req.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  return NextResponse.json(getSignedUploadParams(projectId));
}
```

### 4.4 Delete Route — Cloudinary-first pattern (`app/api/assets/[id]/route.ts`)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { destroyAsset } from "@/lib/cloudinary";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await db.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await destroyAsset(asset.cloudinaryPublicId, asset.resourceType);
  if (result.result !== "ok" && result.result !== "not found") {
    return NextResponse.json({ error: "Cloudinary delete failed, DB row kept" }, { status: 502 });
  }

  await db.mediaAsset.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
```

## 5. Exit Criteria & Verification Tests

```bash
# 1. Install deps and run migration
npm install
npx prisma migrate dev

# 2. Start the app
npm run dev
# open http://localhost:3000/projects

# 3. Test the sign endpoint directly
curl -X POST http://localhost:3000/api/cloudinary/sign \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test-project-id"}'
# Verify: response contains signature, timestamp, api_key, cloud_name, folder

# 4. Verify DB writes via Prisma Studio
npx prisma studio
# Check: Project and MediaAsset rows appear after using the UI

# 5. Verify Cloudinary sync
# Log in to cloudinary.com -> Media Library -> confirm uploaded files
# appear under impact-platform/{projectId}/

# 6. Verify delete does NOT orphan Cloudinary
# Delete an asset in the UI, then refresh Cloudinary Media Library:
# the file must be gone from BOTH places, not just one.
```

## 6. Readiness for Phase 2 Checklist

- [ ] Project create/list/detail all persist correctly after refresh
- [ ] Signed upload works for both images and videos
- [ ] Gallery thumbnails render via Cloudinary transformation URLs (not stored separately)
- [ ] Category + date filters narrow results correctly
- [ ] Edit metadata persists after refresh
- [ ] Delete removes from Cloudinary Media Library **and** DB
- [ ] `MediaAsset` table has stable `id`s ready to be referenced by `AiTag` in Phase 2
