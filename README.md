# EcoEvidence: Proof-of-Impact Media Platform

`License: MIT` `Next.js 14` `TypeScript` `Cloudinary` `PostgreSQL` `Prisma`

An evidence system, built on Cloudinary, that turns raw field photos and videos from NGOs, CSR teams and government programmes into **verified** evidence: every photo gets a Trust Score, every action lands in a tamper-evident ledger, before/after pairs become a measured number, and donors get a reel they can verify by scanning a QR code.

## Why this project?

Field teams produce thousands of photos, and nobody can check them all. Fake and recycled photos are a documented problem: NMMS worksite photos in MGNREGA are now verified by hand (100% at gram-panchayat level under a July 2025 Ministry of Rural Development circular), while CSR impact assessments and SEBI BRSR Core assurance require evidence that holds up to an auditor. Most media tools organise and narrate uploads; EcoEvidence **questions them first**.

## What it does

### 1. Proof-of-Impact Integrity Engine
Each asset is checked on "Submit for verification" (or automatically after upload) and scored 0–100 with plain-language reasons:

| Check | How |
|---|---|
| Exact duplicate | SHA-256 of the stored original + Cloudinary `etag` |
| Recycled image | Cloudinary pHash (`phash: true`), Hamming distance ≤ 10 against every asset; worst when the match is in another project |
| Found on the internet | Google Cloud Vision Web Detection |
| EXIF consistency | Camera time vs claimed/upload time, editing software, stripped metadata (weak signal) |
| Inside project geofence | Photo GPS vs project site + radius |
| Weather plausibility | Open-Meteo history vs rain/wet ground/flooding seen by AI Vision |
| Satellite plausibility | Sentinel-2 NDVI (greening) / NDWI (water) at the site, project start vs photo date |
| AI auditor | Cloudinary AI Vision answers yes/no questions generated from the project's claim |
| Provenance | AI Vision: AI-generated/composited or photo-of-a-screen (low weight) |

Scores ≥ 75 are **Verified**, 45–74 **Review**, < 45 **Flagged**. The score is triage: a review queue shows suspicious photos side by side with their matches, and every human decision is ledgered.

### 2. Tamper-evident ledger
Every upload, edit, check, review, derivative, comparison, measurement, reel and report is an append-only entry with `entryHash = SHA-256(prevHash | canonicalJSON(entry))`. Anyone can re-verify the chain **in their own browser** on the public Verify page. Merkle anchors seal batches of entries; publish the root externally (e.g. a commit to a public repo) to make even a full database rewrite detectable. Derivatives are classified with Cloudinary's Content Credentials vocabulary: **transcoded** (fit/format/quality: still evidence) vs **edited** (crops, overlays: illustrative).

### 3. Public Verify page — `/verify/[assetId]`
Trust Score breakdown, map pin, weather card, satellite values, AI auditor answers, matching photos, web matches, signed original URL, a QR code, and the asset's ledger history with in-browser hash recomputation.

### 4. Measured change + donor reel
Confirmed before/after pairs (auto-suggested from same-spot photos ≥ 7 days apart) get a pixel-measured **green cover** (ExGR with a sky guard) or **water area** percentage, computed in the browser on identically framed Cloudinary derivatives with a manual alignment control. The change mask is stored on Cloudinary and overlaid with `l_…,o_70`. When Copernicus is configured, Sentinel-2 cross-checks the direction of change.

"Make reel" builds a 9:16 or 1:1 video **entirely from Cloudinary transformations**: text cards rendered by image transformations, an `e_zoompan` title card as the splice base, `fl_splice` cross-fades, the measured metric and mask, verified field clips, and a QR outro, delivered as one URL and generated eagerly.

### 5. Grounded impact report
Facts are computed first with no AI; only verified or human-approved assets are cited. The narrative is a fact template, or (with `OPENAI_API_KEY`) an LLM draft that is **rejected if it contains any number not present in the facts**. The same check applies to human edits. Print or save as PDF from the browser; every cited photo carries a QR code to its Verify page.

## Quickstart

Prerequisites: Node.js 18+, Docker (or any PostgreSQL 14+), a Cloudinary account.

```bash
npm install
cp .env.example .env          # fill in Cloudinary keys; see comments for optional checks
docker run -d --name ecoevidence-postgres -e POSTGRES_USER=ecoevidence -e POSTGRES_PASSWORD=ecoevidence_dev -e POSTGRES_DB=ai_media_platform -p 5433:5432 -v ecoevidence_pgdata:/var/lib/postgresql/data postgres:16-alpine
npx prisma migrate deploy
npm run db:seed               # demo projects + photos (uploaded to your Cloudinary), login demo@impactmedia.org / demo123
npm run dev
```

Then open a project and click **Verify N unverified**. The seed stages two frauds: a byte-identical photo resubmitted to another project (Flagged) and a resized, re-compressed copy (caught by pHash, Review). The seeded Pune before/after pair is **synthetic test data** (two different stock photos); use real same-spot field photos for a demo. Stock photos are on the public web, so Web Detection will flag them once enabled.

For QR codes that open on a phone and for Cloudinary webhooks, run behind a public URL (deploy, or `cloudflared tunnel --url http://localhost:3000`) and set `PUBLIC_BASE_URL` / `NEXT_PUBLIC_BASE_URL`.

### Free-tier notes
- Cloudinary AI Vision: enable the add-on in the console (free tier; token cost per image is unpublished, so measure it).
- Google Web Detection: 1,000 units/month. It only runs on explicit verification.
- Copernicus Data Space: 10,000 processing units/month; a check uses two small statistical requests.
- Open-Meteo: keyless, free for non-commercial use.
- C2PA signing (`fl_c2pa`): beta, on request, images only. Set `CLOUDINARY_C2PA_ENABLED=true` once granted.

## API summary

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/projects` | List / create projects |
| GET/PATCH | `/api/projects/[id]` | Project + assets; update site, geofence, impact type, claim |
| POST | `/api/cloudinary/sign` | Signed upload params (includes `phash`, optional `notification_url`) |
| POST | `/api/cloudinary/webhook` | Signature-verified Cloudinary notifications → ledger |
| GET/POST | `/api/assets` | List (filter by project, category, verdict, date) / register an upload |
| GET/PATCH/DELETE | `/api/assets/[id]` | Detail with integrity; edit metadata; delete (Cloudinary first) |
| POST | `/api/assets/[id]/verify` | Run all integrity checks |
| POST | `/api/assets/[id]/review` | Human approve/reject |
| GET | `/api/review-queue` | Review/Flagged assets awaiting a decision |
| GET | `/api/ledger` · `/api/ledger/verify` | Ledger entries · server-side chain verification |
| GET/POST | `/api/ledger/anchor` | List / create Merkle anchors |
| GET | `/api/projects/[id]/suggested-comparisons` | Same-spot before/after candidates |
| GET/POST | `/api/comparisons` · GET `/api/comparisons/[id]` | Saved pairs |
| POST | `/api/comparisons/[id]/metric` | Save a measured change + mask (+ satellite cross-check) |
| POST | `/api/comparisons/[id]/reel` | Build a 9:16 or 1:1 Cloudinary reel |
| GET/POST | `/api/projects/[id]/reports` · PATCH `/api/reports/[id]` | Grounded reports; number-checked edits |
| GET | `/api/qr?url=` | SVG QR code |

## Project structure

```
app/
  api/…                         route handlers (above)
  projects/[id]/                gallery + integrity bar
  projects/[id]/compare/…       pairs, slider, change meter, reel
  projects/[id]/report/         printable grounded report
  review/  ledger/  verify/[assetId]/
components/                     TrustBadge, CheckList, ChainVerifier, ChangeMeter, ReelPanel, …
lib/
  integrity/                    run.ts (orchestrator), score.ts, checks/*
  ledger-core.ts / ledger.ts    hash chain (shared browser/server) and appends
  change-metric.ts              ExGR / water classification + change mask
  reel.ts                       Cloudinary card rendering + splice URL
  reports/                      facts (no AI) + grounded narrative
  cloudinary.ts / cloudinary-url.ts / derivatives.ts
prisma/                         schema, migrations, seed.ts
```

## Known limits
- The Trust Score is a heuristic. Web Detection misses private reuse, EXIF can be forged (and messaging apps strip it), 10 m satellite pixels can't see individual saplings, and "looks AI-generated" answers are unreliable; each check reports its confidence.
- RGB green cover is noisier on handheld photos than in the agronomy studies behind it; results carry an error band and need aligned pairs.
- Field-video transcription/subtitles and AI Video Analysis clip selection are not implemented; reels use the first seconds of verified clips.
- Signing in is optional for the demo; anonymous actions are attributed to the demo user in the ledger.

## License

MIT
