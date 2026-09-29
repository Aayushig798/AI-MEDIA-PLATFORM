/**
 * Demo data: `npx prisma db seed` (idempotent; existing rows are left alone).
 *
 * Sample photos are public Unsplash images, uploaded to your Cloudinary account
 * so they get real pHashes. Because they are on the public web, the Web
 * Detection check will (correctly) flag them. Use your team's own field photos
 * for the "clean" part of the demo.
 */
import { PrismaClient, ImpactType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import { appendLedger } from "../lib/ledger";

const db = new PrismaClient();

const DEMO_USER = { id: "usr_demo123", email: "demo@impactmedia.org", name: "Field Officer Elena", password: "demo123" };

const cloudinaryReady = !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const projects: {
  id: string;
  name: string;
  description: string;
  location: string;
  startDate: string;
  latitude: number;
  longitude: number;
  geofenceRadiusM: number;
  impactType: ImpactType;
  claim: string;
}[] = [
  {
    id: "proj_dungarpur_checkdam",
    name: "Check-dam, Dungarpur",
    description: "Stone check dam on a seasonal stream to recharge groundwater for 4 villages.",
    location: "Dungarpur, Rajasthan, India",
    startDate: "2026-03-01",
    latitude: 23.843,
    longitude: 73.7147,
    geofenceRadiusM: 3000,
    impactType: "WATER",
    claim: "Built a stone check dam across the seasonal stream, with water stored behind the dam",
  },
  {
    id: "proj_pune_miyawaki",
    name: "Miyawaki Plantation, Pune",
    description: "Dense native mini-forest on a former dumping ground.",
    location: "Pune, Maharashtra, India",
    startDate: "2025-06-01",
    latitude: 18.5204,
    longitude: 73.8567,
    geofenceRadiusM: 2000,
    impactType: "GREENING",
    claim: "Planted a dense Miyawaki mini-forest of native saplings",
  },
  {
    id: "proj_amazon_reforest",
    name: "Amazon Basin Reforestation & Canopy Recovery",
    description: "Monitoring canopy regrowth, soil moisture, and native biodiversity restoration in the Madre de Dios region.",
    location: "Madre de Dios, Peru",
    startDate: "2024-01-15",
    latitude: -12.5933,
    longitude: -69.1891,
    geofenceRadiusM: 20000,
    impactType: "GREENING",
    claim: "Planted native mahogany and cedar saplings, and canopy regrowth is visible on restored plots",
  },
  {
    id: "proj_clean_water_kenya",
    name: "Turkana Solar-Powered Aquifer Wells",
    description: "Community solar pumping infrastructure providing clean drinking water to over 15,000 pastoralists.",
    location: "Turkana County, Kenya",
    startDate: "2024-03-10",
    latitude: 3.1191,
    longitude: 35.5973,
    geofenceRadiusM: 30000,
    impactType: "INFRASTRUCTURE",
    claim: "Installed a solar photovoltaic array powering a borehole pump",
  },
  {
    id: "proj_mangrove_restoration",
    name: "Sundarbans Coastal Mangrove Barrier",
    description: "Restoring cyclone storm-surge buffers and estuarine habitats through community mangrove sapling planting.",
    location: "Khulna Division, Bangladesh",
    startDate: "2024-02-01",
    latitude: 22.4,
    longitude: 89.5,
    geofenceRadiusM: 25000,
    impactType: "GREENING",
    claim: "Community members planted mangrove saplings along the estuary embankment",
  },
];

const CANOPY = "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80";

const assets = [
  {
    id: "asset_seed_1",
    projectId: "proj_amazon_reforest",
    publicId: "impact-platform/proj_amazon_reforest/seed_canopy_drone",
    source: CANOPY,
    manualCategory: "Environmental",
    manualLocation: "Plot A-12, Rio Tambopata",
    manualNotes: "Drone survey of nursery sapling canopy expansion after first rainy season.",
    capturedAt: "2024-05-18",
    createdAt: "2024-05-19",
  },
  {
    id: "asset_seed_2",
    projectId: "proj_amazon_reforest",
    publicId: "impact-platform/proj_amazon_reforest/seed_community_planting",
    source: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    manualCategory: "Community",
    manualLocation: "Inambari Nursery, Peru",
    manualNotes: "Local indigenous youth collective preparing 2,000 mahogany and cedar seedlings.",
    capturedAt: "2024-06-02",
    createdAt: "2024-06-03",
  },
  {
    id: "asset_seed_3",
    projectId: "proj_clean_water_kenya",
    publicId: "impact-platform/proj_clean_water_kenya/seed_solar_pump",
    source: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80",
    manualCategory: "Infrastructure",
    manualLocation: "Lodwar Sub-county, Turkana",
    manualNotes: "Commissioning of the 12kW photovoltaic array powering submersible borehole pump.",
    capturedAt: "2024-04-12",
    createdAt: "2024-04-13",
  },
  // Staged fraud: the Amazon drone photo resubmitted as check-dam evidence.
  {
    id: "asset_seed_recycled",
    projectId: "proj_dungarpur_checkdam",
    publicId: "impact-platform/proj_dungarpur_checkdam/seed_recycled_site_photo",
    source: CANOPY,
    manualCategory: "Infrastructure",
    manualLocation: "Check-dam site, Dungarpur",
    manualNotes: "Completed check dam holding water after first monsoon rains.",
    capturedAt: "2026-08-20",
    createdAt: "2026-08-21",
  },
  // Staged fraud: the Amazon nursery photo, re-compressed and resized (so NOT
  // byte-identical), resubmitted as Miyawaki evidence. Only pHash catches this.
  {
    id: "asset_seed_recycled_resized",
    projectId: "proj_pune_miyawaki",
    publicId: "impact-platform/proj_pune_miyawaki/seed_recycled_resized",
    source: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=900&q=55",
    manualCategory: "Community",
    manualLocation: "Miyawaki plot, Pune",
    manualNotes: "Volunteers preparing native saplings for the Miyawaki plot.",
    capturedAt: "2026-07-14",
    createdAt: "2026-07-15",
  },
  // SYNTHETIC before/after pair (two different stock photos) to exercise the
  // comparison, green-cover metric and reel pipeline. Replace with real,
  // same-spot photos from the field for the actual demo.
  {
    id: "asset_seed_pune_before",
    projectId: "proj_pune_miyawaki",
    publicId: "impact-platform/proj_pune_miyawaki/seed_test_before",
    source: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1400&q=80",
    manualCategory: "Environmental",
    manualLocation: "Miyawaki plot B, Pune",
    manualNotes: "TEST DATA: bare plot before planting.",
    capturedAt: "2025-06-10",
    createdAt: "2025-06-11",
  },
  {
    id: "asset_seed_pune_after",
    projectId: "proj_pune_miyawaki",
    publicId: "impact-platform/proj_pune_miyawaki/seed_test_after",
    source: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80",
    manualCategory: "Environmental",
    manualLocation: "Miyawaki plot B, Pune",
    manualNotes: "TEST DATA: dense canopy fifteen months after planting.",
    capturedAt: "2026-08-30",
    createdAt: "2026-08-31",
  },
];

async function uploadIfPossible(source: string, publicId: string) {
  if (!cloudinaryReady) {
    return { secureUrl: source, format: "jpg", bytes: 0, width: null, height: null, etag: null, phash: null };
  }
  const res = await cloudinary.uploader.upload(source, { public_id: publicId, overwrite: false, phash: true });
  return {
    secureUrl: res.secure_url as string,
    format: res.format as string,
    bytes: res.bytes as number,
    width: res.width as number,
    height: res.height as number,
    etag: (res.etag as string) ?? null,
    phash: typeof res.phash === "string" ? res.phash.toLowerCase().padStart(16, "0") : null,
  };
}

async function main() {
  const hash = await bcrypt.hash(DEMO_USER.password, 10);
  await db.user.upsert({
    where: { id: DEMO_USER.id },
    create: { id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name, password: hash },
    update: { password: hash },
  });

  for (const p of projects) {
    await db.project.upsert({
      where: { id: p.id },
      create: { ...p, startDate: new Date(p.startDate), createdBy: DEMO_USER.id, createdAt: new Date(p.startDate) },
      update: {},
    });
  }

  for (const a of assets) {
    if (await db.mediaAsset.findUnique({ where: { id: a.id } })) continue;
    const up = await uploadIfPossible(a.source, a.publicId);
    await db.mediaAsset.create({
      data: {
        id: a.id,
        projectId: a.projectId,
        cloudinaryPublicId: a.publicId,
        secureUrl: up.secureUrl,
        resourceType: "image",
        format: up.format,
        bytes: up.bytes,
        width: up.width,
        height: up.height,
        etag: up.etag,
        phash: up.phash,
        manualCategory: a.manualCategory,
        manualLocation: a.manualLocation,
        manualNotes: a.manualNotes,
        capturedAt: new Date(a.capturedAt),
        createdAt: new Date(a.createdAt),
        uploadedBy: DEMO_USER.id,
        integrity: { create: {} },
      },
    });
    await appendLedger({
      type: "ASSET_UPLOADED",
      actor: "seed-script",
      assetId: a.id,
      projectId: a.projectId,
      payload: {
        cloudinaryPublicId: a.publicId,
        secureUrl: up.secureUrl,
        resourceType: "image",
        bytes: up.bytes,
        etag: up.etag,
        phash: up.phash,
        claimedCapturedAt: new Date(a.capturedAt).toISOString(),
        claimedLocation: a.manualLocation,
        category: a.manualCategory,
      },
    });
    console.log(`seeded ${a.id}${cloudinaryReady ? " (uploaded to Cloudinary)" : ""}`);
  }

  console.log(`Demo login: ${DEMO_USER.email} / ${DEMO_USER.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
