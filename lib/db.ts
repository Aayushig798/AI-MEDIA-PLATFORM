import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// Initialize Prisma Client global singleton for Next.js hot-reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// File-backed fallback store for development when PostgreSQL is not yet configured or offline
const DATA_FILE = path.join(process.cwd(), "prisma", "dev_data.json");

export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  password: string;
  createdAt: string;
}

export interface StoredProject {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  createdBy: string;
  createdAt: string;
  user?: StoredUser;
  assets?: StoredMediaAsset[];
  _count?: { assets: number };
}

export interface StoredAiTag {
  id: string;
  mediaAssetId: string;
  label: string;
  confidence: number;
  source: string; // "cloudinary_google" | "cloudinary_rekognition" | "external_vision"
  createdAt: string;
}

export interface StoredCategory {
  id: string;
  name: string;
}

export interface StoredMediaAssetCategory {
  id: string;
  mediaAssetId: string;
  categoryId: string;
  category?: StoredCategory;
}

export interface StoredMediaAsset {
  id: string;
  projectId: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  resourceType: string;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  manualCategory: string | null;
  manualLocation: string | null;
  manualNotes: string | null;
  capturedAt: string | null;
  uploadedBy: string;
  exifLat?: number | null;
  exifLng?: number | null;
  aiProcessingStatus: string; // "pending" | "processing" | "done" | "failed"
  aiTags?: StoredAiTag[];
  categories?: StoredMediaAssetCategory[];
  createdAt: string;
  updatedAt: string;
  project?: StoredProject;
}

interface LocalDBData {
  users: StoredUser[];
  projects: StoredProject[];
  assets: StoredMediaAsset[];
  aiTags: StoredAiTag[];
  categories: StoredCategory[];
  mediaAssetCategories: StoredMediaAssetCategory[];
}

function loadLocalData(): LocalDBData {
  const defaultCategories: StoredCategory[] = [
    { id: "cat_env", name: "Environmental" },
    { id: "cat_infra", name: "Infrastructure" },
    { id: "cat_comm", name: "Community" },
    { id: "cat_disaster", name: "Disaster Response" },
    { id: "cat_uncat", name: "Uncategorized" },
  ];

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.aiTags) parsed.aiTags = [];
      if (!parsed.categories || parsed.categories.length === 0) parsed.categories = defaultCategories;
      if (!parsed.mediaAssetCategories) parsed.mediaAssetCategories = [];
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load local dev_data.json:", e);
  }

  // Seed default demo data with Phase 2 fields
  const defaultData: LocalDBData = {
    users: [
      {
        id: "usr_demo123",
        email: "demo@impactmedia.org",
        name: "Field Officer Elena",
        password: "demo123_plain_or_hash",
        createdAt: new Date().toISOString(),
      },
    ],
    categories: defaultCategories,
    mediaAssetCategories: [
      { id: "mac_1", mediaAssetId: "asset_seed_1", categoryId: "cat_env" },
      { id: "mac_2", mediaAssetId: "asset_seed_2", categoryId: "cat_comm" },
      { id: "mac_3", mediaAssetId: "asset_seed_3", categoryId: "cat_infra" },
    ],
    aiTags: [
      {
        id: "tag_seed_1",
        mediaAssetId: "asset_seed_1",
        label: "Canopy",
        confidence: 0.98,
        source: "external_vision",
        createdAt: new Date().toISOString(),
      },
      {
        id: "tag_seed_2",
        mediaAssetId: "asset_seed_1",
        label: "Rainforest",
        confidence: 0.95,
        source: "external_vision",
        createdAt: new Date().toISOString(),
      },
      {
        id: "tag_seed_3",
        mediaAssetId: "asset_seed_1",
        label: "Vegetation",
        confidence: 0.92,
        source: "external_vision",
        createdAt: new Date().toISOString(),
      },
      {
        id: "tag_seed_4",
        mediaAssetId: "asset_seed_2",
        label: "Community meeting",
        confidence: 0.94,
        source: "external_vision",
        createdAt: new Date().toISOString(),
      },
      {
        id: "tag_seed_5",
        mediaAssetId: "asset_seed_2",
        label: "Tree nursery sapling",
        confidence: 0.91,
        source: "external_vision",
        createdAt: new Date().toISOString(),
      },
      {
        id: "tag_seed_6",
        mediaAssetId: "asset_seed_3",
        label: "Solar panel array",
        confidence: 0.97,
        source: "external_vision",
        createdAt: new Date().toISOString(),
      },
      {
        id: "tag_seed_7",
        mediaAssetId: "asset_seed_3",
        label: "Water pump infrastructure",
        confidence: 0.93,
        source: "external_vision",
        createdAt: new Date().toISOString(),
      },
    ],
    projects: [
      {
        id: "proj_amazon_reforest",
        name: "Amazon Basin Reforestation & Canopy Recovery",
        description: "Monitoring canopy regrowth, soil moisture, and native biodiversity restoration in the Madre de Dios region.",
        location: "Madre de Dios, Peru",
        startDate: new Date("2024-01-15").toISOString(),
        createdBy: "usr_demo123",
        createdAt: new Date("2024-01-15").toISOString(),
      },
      {
        id: "proj_clean_water_kenya",
        name: "Turkana Solar-Powered Aquifer Wells",
        description: "Community solar pumping infrastructure providing clean drinking water to over 15,000 pastoralists.",
        location: "Turkana County, Kenya",
        startDate: new Date("2024-03-10").toISOString(),
        createdBy: "usr_demo123",
        createdAt: new Date("2024-03-10").toISOString(),
      },
    ],
    assets: [
      {
        id: "asset_seed_1",
        projectId: "proj_amazon_reforest",
        cloudinaryPublicId: "impact-platform/proj_amazon_reforest/seed_canopy_drone",
        secureUrl: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80",
        resourceType: "image",
        format: "jpg",
        bytes: 1420500,
        width: 1920,
        height: 1080,
        manualCategory: "Environmental",
        manualLocation: "Plot A-12, Rio Tambopata",
        manualNotes: "Drone survey of nursery sapling canopy expansion after first rainy season.",
        capturedAt: new Date("2024-05-18").toISOString(),
        uploadedBy: "usr_demo123",
        exifLat: -12.5933,
        exifLng: -69.1891,
        aiProcessingStatus: "done",
        createdAt: new Date("2024-05-19").toISOString(),
        updatedAt: new Date("2024-05-19").toISOString(),
      },
      {
        id: "asset_seed_2",
        projectId: "proj_amazon_reforest",
        cloudinaryPublicId: "impact-platform/proj_amazon_reforest/seed_community_planting",
        secureUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
        resourceType: "image",
        format: "jpg",
        bytes: 980200,
        width: 1600,
        height: 1066,
        manualCategory: "Community",
        manualLocation: "Inambari Nursery, Peru",
        manualNotes: "Local indigenous youth collective preparing 2,000 mahogany and cedar seedlings.",
        capturedAt: new Date("2024-06-02").toISOString(),
        uploadedBy: "usr_demo123",
        exifLat: -12.6500,
        exifLng: -69.2100,
        aiProcessingStatus: "done",
        createdAt: new Date("2024-06-03").toISOString(),
        updatedAt: new Date("2024-06-03").toISOString(),
      },
      {
        id: "asset_seed_3",
        projectId: "proj_clean_water_kenya",
        cloudinaryPublicId: "impact-platform/proj_clean_water_kenya/seed_solar_pump",
        secureUrl: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
        resourceType: "image",
        format: "jpg",
        bytes: 1650300,
        width: 2048,
        height: 1365,
        manualCategory: "Infrastructure",
        manualLocation: "Lodwar Sub-county, Turkana",
        manualNotes: "Commissioning of the 12kW photovoltaic array powering submersible borehole pump.",
        capturedAt: new Date("2024-04-12").toISOString(),
        uploadedBy: "usr_demo123",
        exifLat: 3.1199,
        exifLng: 35.5973,
        aiProcessingStatus: "done",
        createdAt: new Date("2024-04-13").toISOString(),
        updatedAt: new Date("2024-04-13").toISOString(),
      },
    ],
  };

  saveLocalData(defaultData);
  return defaultData;
}

function saveLocalData(data: LocalDBData) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save local dev_data.json:", e);
  }
}

function hasDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(
    url &&
    (url.startsWith("postgresql://") || url.startsWith("postgres://"))
  );
}

async function checkPrismaConnection(): Promise<boolean> {
  return hasDatabaseUrl();
}

export const db = {
  async isPrismaConnected(): Promise<boolean> {
    return hasDatabaseUrl();
  },

  // USERS
  user: {
    async findUnique({ where }: { where: { email?: string; id?: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await (prisma.user.findUnique as any)({ where });
        } catch (e) {
          console.error("[DB Error] prisma.user.findUnique failed:", e);
          throw e;
        }
      }
      const data = loadLocalData();
      return (
        data.users.find(
          (u) => (where.email && u.email.toLowerCase() === where.email.toLowerCase()) || (where.id && u.id === where.id)
        ) || null
      );
    },

    async create({ data }: { data: any }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.user.create({ data });
        } catch (e) {
          console.error("[DB Error] prisma.user.create failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      const newUser: StoredUser = {
        id: data.id || `usr_${Date.now()}`,
        email: data.email,
        name: data.name || null,
        password: data.password,
        createdAt: new Date().toISOString(),
      };
      current.users.push(newUser);
      saveLocalData(current);
      return newUser;
    },
  },

  // PROJECTS
  project: {
    async findMany({ orderBy }: { orderBy?: { createdAt?: "asc" | "desc" } } = {}) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.project.findMany({
            include: {
              _count: {
                select: { assets: true },
              },
            },
            orderBy: orderBy || { createdAt: "desc" },
          });
        } catch (e) {
          console.error("[DB Error] prisma.project.findMany failed:", e);
          throw e;
        }
      }
      const data = loadLocalData();
      const projects = data.projects.map((p) => {
        const assetCount = data.assets.filter((a) => a.projectId === p.id).length;
        return {
          ...p,
          _count: { assets: assetCount },
        };
      });

      projects.sort((a, b) => {
        const order = orderBy?.createdAt === "asc" ? 1 : -1;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order;
      });

      return projects;
    },

    async findUnique({ where, include }: { where: { id: string }; include?: any }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.project.findUnique({
            where,
            include: include || {
              assets: {
                orderBy: { createdAt: "desc" },
                include: {
                  aiTags: true,
                  categories: { include: { category: true } },
                },
              },
              _count: { select: { assets: true } },
            },
          });
        } catch (e) {
          console.error("[DB Error] prisma.project.findUnique failed:", e);
          throw e;
        }
      }
      const data = loadLocalData();
      const project = data.projects.find((p) => p.id === where.id);
      if (!project) return null;

      const projectAssets = data.assets
        .filter((a) => a.projectId === where.id)
        .map((a) => {
          const tags = data.aiTags.filter((t) => t.mediaAssetId === a.id);
          const cats = data.mediaAssetCategories
            .filter((mac) => mac.mediaAssetId === a.id)
            .map((mac) => ({
              ...mac,
              category: data.categories.find((c) => c.id === mac.categoryId),
            }));
          return {
            ...a,
            aiTags: tags,
            categories: cats,
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        ...project,
        assets: projectAssets,
        _count: { assets: projectAssets.length },
      };
    },

    async create({ data }: { data: any }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.project.create({ data });
        } catch (e) {
          console.error("[DB Error] prisma.project.create failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      const newProject: StoredProject = {
        id: data.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: data.name,
        description: data.description || null,
        location: data.location || null,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        createdBy: data.createdBy || "usr_demo123",
        createdAt: new Date().toISOString(),
      };
      current.projects.unshift(newProject);
      saveLocalData(current);
      return newProject;
    },

    async delete({ where }: { where: { id: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.project.delete({ where });
        } catch (e) {
          console.error("[DB Error] prisma.project.delete failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      const proj = current.projects.find((p) => p.id === where.id);
      if (!proj) throw new Error("Project not found");

      const assetIdsToDelete = new Set(
        current.assets.filter((a) => a.projectId === where.id).map((a) => a.id)
      );

      current.projects = current.projects.filter((p) => p.id !== where.id);
      current.assets = current.assets.filter((a) => a.projectId !== where.id);
      current.aiTags = current.aiTags.filter((t) => !assetIdsToDelete.has(t.mediaAssetId));
      current.mediaAssetCategories = current.mediaAssetCategories.filter(
        (mac) => !assetIdsToDelete.has(mac.mediaAssetId)
      );

      saveLocalData(current);
      return proj;
    },
  },

  // CATEGORIES
  category: {
    async upsert({
      where,
      update,
      create,
    }: {
      where: { name: string };
      update: any;
      create: { name: string };
    }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.category.upsert({ where, update, create });
        } catch (e) {
          console.error(`[DB Error] prisma.category.upsert failed for "${where.name}":`, e);
          throw e;
        }
      }
      const current = loadLocalData();
      let cat = current.categories.find(
        (c) => c.name.toLowerCase() === where.name.toLowerCase()
      );
      if (!cat) {
        cat = {
          id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: create.name,
        };
        current.categories.push(cat);
        saveLocalData(current);
      }
      return cat;
    },

    async findMany() {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.category.findMany();
        } catch (e) {
          console.error("[DB Error] prisma.category.findMany failed:", e);
          throw e;
        }
      }
      const data = loadLocalData();
      return data.categories;
    },

    async findUnique({ where }: { where: { id?: string; name?: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.category.findUnique({ where: where as any });
        } catch (e) {
          console.error("[DB Error] prisma.category.findUnique failed:", e);
          throw e;
        }
      }
      const data = loadLocalData();
      return (
        data.categories.find(
          (c) =>
            (where.id && c.id === where.id) ||
            (where.name && c.name.toLowerCase() === where.name.toLowerCase())
        ) || null
      );
    },
  },

  // MEDIA ASSET CATEGORIES
  mediaAssetCategory: {
    async create({ data }: { data: { mediaAssetId: string; categoryId: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.mediaAssetCategory.create({ data });
        } catch (e) {
          console.error(`[DB Error] prisma.mediaAssetCategory.create failed for asset ${data.mediaAssetId}:`, e);
          throw e;
        }
      }
      const current = loadLocalData();
      const existing = current.mediaAssetCategories.find(
        (m) => m.mediaAssetId === data.mediaAssetId && m.categoryId === data.categoryId
      );
      if (existing) return existing;

      const newMac: StoredMediaAssetCategory = {
        id: `mac_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        mediaAssetId: data.mediaAssetId,
        categoryId: data.categoryId,
      };
      current.mediaAssetCategories.push(newMac);
      saveLocalData(current);
      return newMac;
    },

    async deleteMany({ where }: { where: { mediaAssetId: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.mediaAssetCategory.deleteMany({ where });
        } catch (e) {
          console.error(`[DB Error] prisma.mediaAssetCategory.deleteMany failed for asset ${where.mediaAssetId}:`, e);
          throw e;
        }
      }
      const current = loadLocalData();
      current.mediaAssetCategories = current.mediaAssetCategories.filter(
        (m) => m.mediaAssetId !== where.mediaAssetId
      );
      saveLocalData(current);
      return { count: 1 };
    },

    async findMany({
      where,
      include,
    }: {
      where: { mediaAssetId: string };
      include?: any;
    }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.mediaAssetCategory.findMany({
            where,
            include: include || { category: true },
          });
        } catch (e) {
          console.error("[DB Error] prisma.mediaAssetCategory.findMany failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      return current.mediaAssetCategories
        .filter((m) => m.mediaAssetId === where.mediaAssetId)
        .map((m) => ({
          ...m,
          category: current.categories.find((c) => c.id === m.categoryId),
        }));
    },
  },

  // AI TAGS
  aiTag: {
    async create({
      data,
    }: {
      data: {
        mediaAssetId: string;
        label: string;
        confidence: number;
        source: string;
      };
    }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.aiTag.create({
            data: {
              mediaAssetId: data.mediaAssetId,
              label: data.label,
              confidence: Number(data.confidence),
              source: data.source,
            },
          });
        } catch (e) {
          console.error(`[DB Error] prisma.aiTag.create failed for label "${data.label}" on asset ${data.mediaAssetId}:`, e);
          throw e;
        }
      }
      const current = loadLocalData();
      const newTag: StoredAiTag = {
        id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        mediaAssetId: data.mediaAssetId,
        label: data.label,
        confidence: Number(data.confidence) || 0.9,
        source: data.source,
        createdAt: new Date().toISOString(),
      };
      current.aiTags.push(newTag);
      saveLocalData(current);
      return newTag;
    },

    async createMany({
      data,
    }: {
      data: Array<{
        mediaAssetId: string;
        label: string;
        confidence: number;
        source: string;
      }>;
    }) {
      if (!data || data.length === 0) return { count: 0 };
      if (hasDatabaseUrl()) {
        try {
          return await prisma.aiTag.createMany({
            data: data.map((d) => ({
              mediaAssetId: d.mediaAssetId,
              label: d.label,
              confidence: Number(d.confidence),
              source: d.source,
            })),
          });
        } catch (e) {
          console.error(`[DB Error] prisma.aiTag.createMany failed for ${data.length} tags:`, e);
          throw e;
        }
      }
      const current = loadLocalData();
      for (const d of data) {
        current.aiTags.push({
          id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          mediaAssetId: d.mediaAssetId,
          label: d.label,
          confidence: Number(d.confidence) || 0.9,
          source: d.source,
          createdAt: new Date().toISOString(),
        });
      }
      saveLocalData(current);
      return { count: data.length };
    },

    async findMany({
      where,
      orderBy = { confidence: "desc" },
    }: {
      where?: { mediaAssetId?: string; id?: string };
      orderBy?: any;
    } = {}) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.aiTag.findMany({
            where,
            orderBy: orderBy as any,
          });
        } catch (e) {
          console.error("[DB Error] prisma.aiTag.findMany failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      let results = [...current.aiTags];
      if (where?.mediaAssetId) {
        results = results.filter((t) => t.mediaAssetId === where.mediaAssetId);
      }
      return results.sort((a, b) => b.confidence - a.confidence);
    },

    async delete({ where }: { where: { id: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.aiTag.delete({ where });
        } catch (e) {
          console.error(`[DB Error] prisma.aiTag.delete failed for tag ${where.id}:`, e);
          throw e;
        }
      }
      const current = loadLocalData();
      const tag = current.aiTags.find((t) => t.id === where.id);
      if (!tag) throw new Error("Tag not found");
      current.aiTags = current.aiTags.filter((t) => t.id !== where.id);
      saveLocalData(current);
      return tag;
    },

    async deleteMany({ where }: { where: { mediaAssetId: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.aiTag.deleteMany({ where });
        } catch (e) {
          console.error(`[DB Error] prisma.aiTag.deleteMany failed for asset ${where.mediaAssetId}:`, e);
          throw e;
        }
      }
      const current = loadLocalData();
      current.aiTags = current.aiTags.filter((t) => t.mediaAssetId !== where.mediaAssetId);
      saveLocalData(current);
      return { count: 1 };
    },
  },

  // MEDIA ASSETS
  mediaAsset: {
    async findMany({
      where = {},
      orderBy = { createdAt: "desc" },
      include = { aiTags: true, categories: { include: { category: true } } },
    }: {
      where?: {
        projectId?: string;
        manualCategory?: string;
        aiCategory?: string;
        capturedAt?: { gte?: Date | string; lte?: Date | string };
        createdAt?: { gte?: Date | string; lte?: Date | string };
      };
      orderBy?: { createdAt?: "asc" | "desc" };
      include?: any;
    } = {}) {
      if (hasDatabaseUrl()) {
        try {
          const prismaWhere: any = {};
          if (where.projectId) prismaWhere.projectId = where.projectId;
          if (where.manualCategory && where.manualCategory !== "ALL") {
            prismaWhere.manualCategory = where.manualCategory;
          }
          if (where.aiCategory && where.aiCategory !== "ALL") {
            prismaWhere.categories = {
              some: {
                category: {
                  name: {
                    equals: where.aiCategory,
                    mode: "insensitive",
                  },
                },
              },
            };
          }
          if (where.capturedAt) prismaWhere.capturedAt = where.capturedAt;
          if (where.createdAt) prismaWhere.createdAt = where.createdAt;

          return await prisma.mediaAsset.findMany({
            where: prismaWhere,
            orderBy: orderBy as any,
            include: include || {
              aiTags: true,
              categories: { include: { category: true } },
            },
          });
        } catch (e) {
          console.error("[DB Error] prisma.mediaAsset.findMany failed:", e);
          throw e;
        }
      }

      const data = loadLocalData();
      let results = [...data.assets];

      if (where.projectId) {
        results = results.filter((a) => a.projectId === where.projectId);
      }

      if (where.manualCategory && where.manualCategory !== "ALL") {
        results = results.filter(
          (a) => a.manualCategory && a.manualCategory.toLowerCase() === where.manualCategory?.toLowerCase()
        );
      }

      if (where.aiCategory && where.aiCategory !== "ALL") {
        const catName = where.aiCategory.toLowerCase();
        const matchingCat = data.categories.find((c) => c.name.toLowerCase() === catName);
        if (matchingCat) {
          const assetIdsWithCat = new Set(
            data.mediaAssetCategories
              .filter((mac) => mac.categoryId === matchingCat.id)
              .map((mac) => mac.mediaAssetId)
          );
          results = results.filter((a) => assetIdsWithCat.has(a.id));
        } else {
          results = [];
        }
      }

      if (where.capturedAt || where.createdAt) {
        const dateFilter = where.capturedAt || where.createdAt;
        if (dateFilter?.gte) {
          const gteTime = new Date(dateFilter.gte).getTime();
          results = results.filter((a) => {
            const dateVal = a.capturedAt || a.createdAt;
            return new Date(dateVal).getTime() >= gteTime;
          });
        }
        if (dateFilter?.lte) {
          const lteTime = new Date(dateFilter.lte).getTime();
          results = results.filter((a) => {
            const dateVal = a.capturedAt || a.createdAt;
            return new Date(dateVal).getTime() <= lteTime;
          });
        }
      }

      results.sort((a, b) => {
        const order = orderBy.createdAt === "asc" ? 1 : -1;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order;
      });

      // Hydrate aiTags and categories
      return results.map((a) => {
        const tags = data.aiTags.filter((t) => t.mediaAssetId === a.id);
        const cats = data.mediaAssetCategories
          .filter((mac) => mac.mediaAssetId === a.id)
          .map((mac) => ({
            ...mac,
            category: data.categories.find((c) => c.id === mac.categoryId),
          }));
        return {
          ...a,
          aiTags: tags,
          categories: cats,
        };
      });
    },

    async findUnique({
      where,
      include,
    }: {
      where: { id?: string; cloudinaryPublicId?: string };
      include?: any;
    }) {
      if (hasDatabaseUrl()) {
        try {
          return await (prisma.mediaAsset.findUnique as any)({
            where,
            include: include || {
              aiTags: { orderBy: { confidence: "desc" } },
              categories: { include: { category: true } },
            },
          });
        } catch (e) {
          console.error("[DB Error] prisma.mediaAsset.findUnique failed:", e);
          throw e;
        }
      }
      const data = loadLocalData();
      const asset = data.assets.find(
        (a) =>
          (where.id && a.id === where.id) ||
          (where.cloudinaryPublicId && a.cloudinaryPublicId === where.cloudinaryPublicId)
      );
      if (!asset) return null;

      const tags = data.aiTags
        .filter((t) => t.mediaAssetId === asset.id)
        .sort((a, b) => b.confidence - a.confidence);

      const cats = data.mediaAssetCategories
        .filter((mac) => mac.mediaAssetId === asset.id)
        .map((mac) => ({
          ...mac,
          category: data.categories.find((c) => c.id === mac.categoryId),
        }));

      return {
        ...asset,
        aiTags: tags,
        categories: cats,
      };
    },

    async create({ data }: { data: any }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.mediaAsset.create({
            data,
            include: {
              aiTags: true,
              categories: { include: { category: true } },
            },
          });
        } catch (e) {
          console.error("[DB Error] prisma.mediaAsset.create failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      const newAsset: StoredMediaAsset = {
        id: data.id || `asset_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        projectId: data.projectId,
        cloudinaryPublicId: data.cloudinaryPublicId,
        secureUrl: data.secureUrl,
        resourceType: data.resourceType,
        format: data.format,
        bytes: Number(data.bytes) || 0,
        width: data.width ? Number(data.width) : null,
        height: data.height ? Number(data.height) : null,
        manualCategory: data.manualCategory || null,
        manualLocation: data.manualLocation || null,
        manualNotes: data.manualNotes || null,
        capturedAt: data.capturedAt ? new Date(data.capturedAt).toISOString() : null,
        uploadedBy: data.uploadedBy || "usr_demo123",
        exifLat: data.exifLat !== undefined ? data.exifLat : null,
        exifLng: data.exifLng !== undefined ? data.exifLng : null,
        aiProcessingStatus: data.aiProcessingStatus || "pending",
        aiTags: [],
        categories: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      current.assets.unshift(newAsset);
      saveLocalData(current);
      return newAsset;
    },

    async update({ where, data }: { where: { id: string }; data: any }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.mediaAsset.update({
            where,
            data,
            include: {
              aiTags: true,
              categories: { include: { category: true } },
            },
          });
        } catch (e) {
          console.error("[DB Error] prisma.mediaAsset.update failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      const index = current.assets.findIndex((a) => a.id === where.id);
      if (index === -1) throw new Error("Asset not found");

      const existing = current.assets[index];
      const updated: StoredMediaAsset = {
        ...existing,
        manualCategory: data.manualCategory !== undefined ? data.manualCategory : existing.manualCategory,
        manualLocation: data.manualLocation !== undefined ? data.manualLocation : existing.manualLocation,
        manualNotes: data.manualNotes !== undefined ? data.manualNotes : existing.manualNotes,
        capturedAt:
          data.capturedAt !== undefined
            ? data.capturedAt
              ? new Date(data.capturedAt).toISOString()
              : null
            : existing.capturedAt,
        exifLat: data.exifLat !== undefined ? data.exifLat : existing.exifLat,
        exifLng: data.exifLng !== undefined ? data.exifLng : existing.exifLng,
        aiProcessingStatus:
          data.aiProcessingStatus !== undefined
            ? data.aiProcessingStatus
            : existing.aiProcessingStatus,
        updatedAt: new Date().toISOString(),
      };
      current.assets[index] = updated;
      saveLocalData(current);

      const tags = current.aiTags.filter((t) => t.mediaAssetId === updated.id);
      const cats = current.mediaAssetCategories
        .filter((mac) => mac.mediaAssetId === updated.id)
        .map((mac) => ({
          ...mac,
          category: current.categories.find((c) => c.id === mac.categoryId),
        }));

      return {
        ...updated,
        aiTags: tags,
        categories: cats,
      };
    },

    async delete({ where }: { where: { id: string } }) {
      if (hasDatabaseUrl()) {
        try {
          return await prisma.mediaAsset.delete({ where });
        } catch (e) {
          console.error("[DB Error] prisma.mediaAsset.delete failed:", e);
          throw e;
        }
      }
      const current = loadLocalData();
      const asset = current.assets.find((a) => a.id === where.id);
      if (!asset) throw new Error("Asset not found");

      current.assets = current.assets.filter((a) => a.id !== where.id);
      current.aiTags = current.aiTags.filter((t) => t.mediaAssetId !== where.id);
      current.mediaAssetCategories = current.mediaAssetCategories.filter(
        (m) => m.mediaAssetId !== where.id
      );
      saveLocalData(current);
      return asset;
    },
  },
};
