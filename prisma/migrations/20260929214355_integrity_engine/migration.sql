-- CreateEnum
CREATE TYPE "ImpactType" AS ENUM ('GREENING', 'WATER', 'INFRASTRUCTURE', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrityStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('VERIFIED', 'REVIEW', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WebMatchKind" AS ENUM ('FULL', 'PARTIAL', 'PAGE');

-- CreateEnum
CREATE TYPE "DerivationClass" AS ENUM ('TRANSCODED', 'EDITED');

-- CreateEnum
CREATE TYPE "MetricKind" AS ENUM ('GREEN_COVER', 'WATER_AREA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geofenceRadiusM" INTEGER NOT NULL DEFAULT 5000,
    "impactType" "ImpactType" NOT NULL DEFAULT 'OTHER',
    "claim" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "manualCategory" TEXT,
    "manualLocation" TEXT,
    "manualNotes" TEXT,
    "capturedAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "etag" TEXT,
    "sha256" TEXT,
    "phash" TEXT,
    "claimText" TEXT,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetIntegrity" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "IntegrityStatus" NOT NULL DEFAULT 'PENDING',
    "trustScore" INTEGER,
    "verdict" "Verdict",
    "checks" JSONB NOT NULL DEFAULT '[]',
    "exif" JSONB,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3),
    "error" TEXT,
    "reviewDecision" "ReviewDecision",
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetIntegrity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhashMatch" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "matchAssetId" TEXT NOT NULL,
    "hamming" INTEGER NOT NULL,
    "crossProject" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhashMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebMatch" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "WebMatchKind" NOT NULL,
    "score" DOUBLE PRECISION,
    "pageTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DerivedAsset" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transformation" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "class" "DerivationClass" NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "assetId" TEXT,
    "projectId" TEXT,
    "actor" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT NOT NULL,
    "entryHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleAnchor" (
    "id" TEXT NOT NULL,
    "fromSeq" INTEGER NOT NULL,
    "toSeq" INTEGER NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "root" TEXT NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "beforeAssetId" TEXT NOT NULL,
    "afterAssetId" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeMetric" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "metric" "MetricKind" NOT NULL,
    "beforePct" DOUBLE PRECISION NOT NULL,
    "afterPct" DOUBLE PRECISION NOT NULL,
    "deltaPp" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "maskPublicId" TEXT,
    "maskUrl" TEXT,
    "alignment" JSONB,
    "satDelta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "comparisonId" TEXT,
    "aspect" TEXT NOT NULL,
    "deliveryUrl" TEXT NOT NULL,
    "sourceAssetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "narrative" TEXT NOT NULL,
    "narrativeBy" TEXT NOT NULL,
    "citedAssetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_cloudinaryPublicId_key" ON "MediaAsset"("cloudinaryPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetIntegrity_assetId_key" ON "AssetIntegrity"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "PhashMatch_assetId_matchAssetId_key" ON "PhashMatch"("assetId", "matchAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedAsset_url_key" ON "DerivedAsset"("url");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_seq_key" ON "LedgerEntry"("seq");

-- CreateIndex
CREATE INDEX "LedgerEntry_assetId_idx" ON "LedgerEntry"("assetId");

-- CreateIndex
CREATE INDEX "LedgerEntry_projectId_idx" ON "LedgerEntry"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetIntegrity" ADD CONSTRAINT "AssetIntegrity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhashMatch" ADD CONSTRAINT "PhashMatch_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebMatch" ADD CONSTRAINT "WebMatch_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedAsset" ADD CONSTRAINT "DerivedAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeMetric" ADD CONSTRAINT "ChangeMetric_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
