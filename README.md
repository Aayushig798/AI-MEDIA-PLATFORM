# EcoEvidence: Proof-of-Impact Media Platform

`License: MIT` `Next.js 14` `TypeScript` `Cloudinary` `PostgreSQL + pgvector` `OpenAI`

An AI media platform, built on Cloudinary, that turns raw field photos and videos from NGOs, CSR teams and government programmes into **organized, searchable and verified** evidence. Every photo gets a Trust Score, every action lands in a tamper-evident ledger, before/after pairs become a measured number, and stakeholders get reports and reels they can verify by scanning a QR code.

## Why this project?

Field teams produce thousands of photos, and nobody can check them all. Fake and recycled photos are a documented problem: NMMS worksite photos under MGNREGA are now verified by hand (100% at gram-panchayat level under a July 2025 Ministry of Rural Development circular), while CSR impact assessments and SEBI BRSR Core assurance require evidence that holds up to an auditor. EcoEvidence organizes the evidence **and questions it first**.

## What it does

**Foundation (Phase 1).** Projects, signed direct-to-Cloudinary uploads (images and video), a gallery with category/date filters, editable metadata, and Cloudinary-first deletion.

**AI understanding (Phase 2).** Automatic tagging (Cloudinary Google auto-tagging at upload, Google Vision fallback), one primary domain category per asset (Environmental, Infrastructure, Community, Disaster Response), EXIF GPS extraction, tag rejection and re-analysis.

**Search & comparison (Phase 3).** Hybrid semantic search (OpenAI embeddings + pgvector cosine distance + lexical ranking), suggested before/after pairs with AI same-scene verification, and a before/after slider.

**Reporting (Phase 4).** Structured project facts computed without AI, a grounded narrative (GPT-4o-mini or a fact template), an editable report studio, PDF export, a per-asset traceability timeline and an analytics dashboard.

**Proof-of-Impact Integrity Engine.** Each asset is scored 0–100 with plain-language reasons, automatically after upload or on demand:

| Check | How |
|---|---|
| Exact duplicate | SHA-256 of the stored original + Cloudinary `etag` |
| Recycled image | Cloudinary pHash (signed `phash: true`), Hamming distance ≤ 10 against every asset; worst when the match is in another project |
| Found on the internet | Google Cloud Vision Web Detection |
| EXIF consistency | Camera time vs claimed/upload time, editing software, stripped metadata (weak signal) |
| Inside project geofence | Photo GPS vs project site + radius |
| Weather plausibility | Open-Meteo history vs rain/wet ground/flooding seen by AI Vision |
| Satellite plausibility | Sentinel-2 NDVI (greening) / NDWI (water) at the site, project start vs photo date |
| AI auditor | Cloudinary AI Vision answers yes/no questions generated from the claim |
| Provenance | AI Vision: AI-generated/composited or photo-of-a-screen (low weight) |

≥ 75 is **Verified**, 45–74 **Review**, < 45 **Flagged**. With fewer than 3 checks able to run, an asset is held at Review. The score is triage: the review queue shows suspicious photos next to their matches, and every human decision is ledgered. Flagged photos never pair, are hidden from search by default, and are excluded from reports and the impact map.

**Tamper-evident ledger.** Every upload, tag, embedding, edit, check, review, derivative, comparison, measurement, reel and report is an append-only entry with `entryHash = SHA-256(prevHash | canonicalJSON(entry))`. The existing audit log is mirrored into it. Anyone can re-verify the chain in their own browser. A daily GitHub Action seals new entries under a Merkle root and commits it to `ledger-anchors/ANCHORS.md`, so even a full database rewrite is detectable. Derivatives are labelled with Cloudinary's Content Credentials vocabulary: **transcoded** (still evidence) vs **edited** (illustrative). `fl_c2pa` signing switches on with a flag once Cloudinary grants the beta.

**Public Verify page `/verify/[assetId]`.** Trust Score breakdown, map, weather, satellite values, AI auditor answers, matching photos, web matches, a signed original URL, a QR code, "Ask the auditor" (AI Vision answers questions about the photo), and the asset's hash-chained history.

**Measured change + donor reel.** From a saved comparison, "Measure & reel" computes green cover (ExGR with a sky guard) or water area on identically framed Cloudinary derivatives with manual alignment. The change mask is stored on Cloudinary and overlaid with `l_…,o_70`; Sentinel-2 cross-checks the direction of change. A 9:16 or 1:1 reel is then built **entirely from Cloudinary transformations**:
- text cards rendered by image transformations;
- an `e_zoompan` title card;
- `fl_splice` cross-fades;
- the measured metric and mask;
- verified field clips, with the moment picked by AI Vision frame analysis and optional burned-in voice-note subtitles;
- a QR outro, delivered as one eagerly generated URL.

**Grounded reports.** Reports cite verified evidence by default. The narrative (LLM or template) and any human edit are **rejected if they state a number that isn't in the facts**. The PDF shows each photo's Trust Score and a QR code to its Verify page, measured change, and ledger status.

**Impact map.** `/map` and each project dashboard plot verified evidence at its photo GPS (or project site), each linked to its verification.

## Quickstart

Prerequisites: Node.js 18+, Docker (or any PostgreSQL 14+ with pgvector), a Cloudinary account.

```bash
npm install
cp .env.example .env          # Cloudinary keys; see comments for optional checks
docker run -d --name ecoevidence-postgres -e POSTGRES_USER=ecoevidence -e POSTGRES_PASSWORD=ecoevidence_dev -e POSTGRES_DB=ai_media_platform -p 5433:5432 -v ecoevidence_pgvector_data:/var/lib/postgresql/data pgvector/pgvector:pg16
npm run db:setup              # CREATE EXTENSION vector, prisma db push, HNSW index
npm run db:seed               # demo projects + photos (uploaded to your Cloudinary), login demo@impactmedia.org / demo123
npm run dev
```

Open a project and click **Verify N unverified**. The seed stages two frauds: a byte-identical photo resubmitted to another project (Flagged) and a resized, re-compressed copy (caught by pHash, Review). The seeded Pune before/after pair is **synthetic test data** (two different stock photos); use real same-spot field photos for a demo. Stock photos are on the public web, so Web Detection will flag them once enabled.

Without `DATABASE_URL`, the Phase 1–4 features fall back to `prisma/dev_data.json`; the Integrity Engine, ledger, reels and map need PostgreSQL.

For QR codes that open on a phone and for Cloudinary webhooks, run behind a public URL (deploy, or `cloudflared tunnel --url http://localhost:3000`) and set `PUBLIC_BASE_URL` / `NEXT_PUBLIC_BASE_URL`.

### Optional services (each check is skipped, not failed, when unset)
| Setting | Enables | Free tier |
|---|---|---|
| Cloudinary **AI Vision** add-on (console) | AI auditor, provenance, weather cues, clip picking, Ask the auditor | free tier; token cost per image unpublished |
| `OPENAI_API_KEY` | embeddings, pair verification, LLM report narrative, captions | paid |
| `GOOGLE_VISION_API_KEY` | tagging fallback + web detection | 1,000 units/month |
| `COPERNICUS_CLIENT_ID/SECRET` | Sentinel-2 satellite check | 10,000 PU/month |
| `CLOUDINARY_AUTO_TRANSCRIPTION=true` | voice-note subtitles on reel clips | check your plan |
| `CLOUDINARY_C2PA_ENABLED=true` | signed Content Credentials on evidence images | beta, on request |
| `ANCHOR_TOKEN` + repo secrets `APP_URL`, `ANCHOR_TOKEN` | daily public Merkle anchors | — |

## Deployment

`Dockerfile` builds a standalone Next.js image with system Chromium for PDF export; `.github/workflows/deploy.yml` redeploys to EC2 on every push to `main`. Run `npm run db:setup` against the production database once after schema changes.

## Key routes

| Path | Purpose |
|---|---|
| `/projects/[id]` | Gallery (Trust Scores, verdict filter, verify-all, site & claim), comparisons tab |
| `/projects/[id]/compare/[comparisonId]` | Measure change, make reels |
| `/projects/[id]/report`, `/projects/[id]/dashboard` | Report studio, analytics + integrity + map |
| `/search`, `/review`, `/ledger`, `/map` | Semantic search, review queue, ledger explorer, impact map |
| `/verify/[assetId]` | Public verification page |
| `POST /api/assets/[id]/verify` | Run all integrity checks |
| `POST /api/comparisons/[id]/metric`, `/reel` | Save measured change, build a reel |
| `GET /api/ledger`, `/api/ledger/verify`, `POST /api/ledger/anchor` | Ledger feed, verification, anchoring |
| `POST /api/search`, `GET /api/assets/[id]/audit-log`, `GET /api/reports/[id]/export` | Search, traceability, PDF |

## Known limits
- The Trust Score is a heuristic. Web Detection misses private reuse, EXIF can be forged (and messaging apps strip it), 10 m satellite pixels can't see individual saplings, and "looks AI-generated" answers are unreliable; every check reports its confidence.
- RGB green cover is noisier on handheld photos than in the agronomy studies behind it. It carries an error band and needs aligned pairs; the server stores the browser's measurement and mask without recomputing them.
- Signing in is optional for the demo; anonymous actions are attributed to the demo user in the ledger, and review decisions aren't restricted to reviewers.

## License

MIT
