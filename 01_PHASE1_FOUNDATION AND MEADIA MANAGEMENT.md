# PHASE 1 — Foundation & Media Management

> Read `00_MASTER_PLAN.md` first for the shared tech stack and conventions. This phase has **no AI** — it is intentionally pure CRUD + Cloudinary storage, the foundation everything else builds on.

## 1. Objective
Let a field/NGO team create projects and upload photos/videos into them, organized by project, location, and date, with a working gallery — no AI involved yet.

## 2. Tech stack for this phase
Next.js 14 (App Router, TypeScript), Tailwind CSS, Prisma + PostgreSQL, Cloudinary (signed uploads + CDN delivery), NextAuth (Credentials provider) or a single seeded demo user if auth needs to be skipped for speed.

## 3. Features to implement
- Create / list / view a **Project** (name, description, location text, start date)
- Upload multiple images/videos to a project via a signed direct-to-Cloudinary upload
- Manual tagging on upload (category, location override, notes)
- Gallery view per project: responsive grid of thumbnails, newest first
- Filter gallery by manual category and date range
- Asset detail view: full-size preview, metadata, manual tags, delete button
- Edit manual metadata on an existing asset
- Delete an asset (must delete from Cloudinary **and** the database)

## 4. Explicitly NOT implemented in this phase
- No AI auto-tagging, auto-categorization, or moderation
- No semantic/natural-language search
- No before/after comparison
- No reports, exports, or dashboards
- No audit/traceability log beyond `created_at`/`updated_at`

## 5. Database schema (Prisma models to create)
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  createdAt DateTime @default(now())
  projects  Project[]
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  location    String?
  startDate   DateTime?
  createdBy   String
  user        User     @relation(fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())
  assets      MediaAsset[]
}

model MediaAsset {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id])
  cloudinaryPublicId String @unique
  secureUrl       String
  resourceType    String   // "image" | "video"
  format          String
  bytes           Int
  width           Int?
  height          Int?
  manualCategory  String?
  manualLocation  String?
  manualNotes     String?
  capturedAt      DateTime?
  uploadedBy      String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## 6. Cloudinary integration details
- Use **signed uploads**: backend route `/api/cloudinary/sign` generates a signature (timestamp + folder + upload preset) using the Cloudinary Node SDK and the API secret — the secret never reaches the browser.
- Frontend uploads directly to `https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload` using the signed params (use `resource_type=auto` so images and videos both work).
- Folder convention: `impact-platform/{projectId}/{uuid}`.
- On upload success, Cloudinary returns `public_id`, `secure_url`, `resource_type`, `format`, `bytes`, `width`, `height` — persist all of these to `MediaAsset`.
- Generate a thumbnail on the fly for gallery grids using a Cloudinary transformation URL, e.g. `c_thumb,w_300,h_300,g_auto` inserted into the delivery URL — do not store a separate thumbnail file.
- On delete, call the Cloudinary Admin API `destroy` with the stored `public_id` before removing the DB row; if Cloudinary deletion fails, do not delete the DB row (avoid orphaned Cloudinary assets vs. missing UI records).

## 7. API endpoints to build
- `POST /api/projects` — create project
- `GET /api/projects` — list projects
- `GET /api/projects/[id]` — project detail + its assets
- `POST /api/cloudinary/sign` — return signed upload params
- `POST /api/assets` — persist an asset record after Cloudinary upload succeeds
- `GET /api/assets?projectId=&category=&from=&to=` — filtered asset list
- `PATCH /api/assets/[id]` — edit manual metadata
- `DELETE /api/assets/[id]` — delete from Cloudinary + DB

## 8. Frontend screens
- `/login` (or skip if using a single seeded demo user)
- `/projects` — project list + "New Project" button/modal
- `/projects/[id]` — gallery grid + upload button + filter bar
- Upload modal — multi-file dropzone, per-file manual tag inputs, progress bar
- Asset detail modal/page — large preview, metadata panel, edit/delete actions

## 9. Data flow
Frontend requests a signature from `/api/cloudinary/sign` → uploads file(s) directly to Cloudinary → Cloudinary responds with asset metadata → frontend POSTs that metadata + manual tags to `/api/assets` → backend writes a `MediaAsset` row → gallery re-fetches and displays via Cloudinary CDN URLs.

## 10. Definition of Done (verify before starting Phase 2)
- [ ] Can create a project and see it in the project list
- [ ] Can upload at least 5 mixed image + video files to a project in one batch
- [ ] All uploaded files appear in the gallery with correct thumbnails, served from Cloudinary
- [ ] Filtering by category and date range narrows the gallery correctly
- [ ] Editing an asset's manual metadata persists after page refresh
- [ ] Deleting an asset removes it from both the gallery and the Cloudinary media library
- [ ] `.env.example` documents `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXTAUTH_SECRET`

---

## PROMPT FOR ANTIGRAVITY — Phase 1

```
You are implementing Phase 1 of a 4-phase hackathon project called
"AI-Powered Impact & Sustainability Media Platform." This is PHASE 1 ONLY —
do not implement AI features, search, comparisons, or reporting; those come
in later phases and will be requested separately.

Tech stack (do not substitute):
- Next.js 14, App Router, TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL
- Cloudinary (signed direct uploads + CDN delivery, no AI add-ons yet)
- NextAuth Credentials provider for a minimal single-org login (or a single
  seeded demo user if that's faster — your choice, keep it simple)

Build the following:

1. Prisma schema with three models: User, Project, MediaAsset (fields as
   specified below). Run the initial migration.

2. A signed-upload flow:
   - POST /api/cloudinary/sign returns signature, timestamp, api_key,
     cloud_name, and folder for a given projectId, using the Cloudinary
     Node SDK server-side (never expose the API secret to the client).
   - Frontend uploads directly to Cloudinary's upload endpoint using these
     signed params, resource_type=auto, folder pattern
     impact-platform/{projectId}/{uuid}.
   - After a successful Cloudinary upload, POST the returned metadata
     (public_id, secure_url, resource_type, format, bytes, width, height)
     plus any manual tags (category, location override, notes) to
     POST /api/assets, which creates a MediaAsset row.

3. CRUD API routes: POST/GET /api/projects, GET /api/projects/[id],
   GET /api/assets (with projectId, category, from, to query filters),
   PATCH /api/assets/[id], DELETE /api/assets/[id] (must call Cloudinary's
   destroy API with the stored public_id before removing the DB row; if
   Cloudinary deletion fails, do not delete the DB row).

4. Frontend pages:
   - /projects: list of projects + "New Project" modal (name, description,
     location, start date)
   - /projects/[id]: responsive gallery grid of thumbnails (use a Cloudinary
     transformation URL like c_thumb,w_300,h_300,g_auto for grid thumbnails,
     not a separately stored thumbnail file), an "Upload Media" button
     opening a multi-file dropzone modal with per-file manual tag inputs and
     an upload progress indicator, and a filter bar for category and date
     range.
   - Asset detail view (modal or route): full-size preview (image or video
     player), metadata panel, edit-metadata form, delete button with
     confirmation.

5. Create a .env.example documenting DATABASE_URL, CLOUDINARY_CLOUD_NAME,
   CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, NEXTAUTH_SECRET.

6. Keep all Cloudinary and DB logic in /lib service files (e.g.,
   lib/cloudinary.ts, lib/db.ts) called from route handlers, not inlined in
   the routes.

Definition of done: I can create a project, upload a batch of mixed
image/video files, see them in a filterable gallery grid served from
Cloudinary, edit an asset's metadata and see it persist, and delete an asset
so it disappears from both the gallery and Cloudinary.

Do not add any AI/ML services, search, or reporting features — those are
explicitly out of scope for this phase.
```
