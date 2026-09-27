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
  createdAt: string;
  updatedAt: string;
  project?: StoredProject;
}

interface LocalDBData {
  users: StoredUser[];
  projects: StoredProject[];
  assets: StoredMediaAsset[];
}

function loadLocalData(): LocalDBData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load local dev_data.json:", e);
  }

  // Seed default demo data
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
      {
        id: "proj_mangrove_restoration",
        name: "Sundarbans Coastal Mangrove Barrier",
        description: "Restoring cyclone storm-surge buffers and estuarine habitats through community mangrove sapling planting.",
        location: "Khulna Division, Bangladesh",
        startDate: new Date("2024-02-01").toISOString(),
        createdBy: "usr_demo123",
        createdAt: new Date("2024-02-01").toISOString(),
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

let isPrismaAvailable: boolean | null = null;

async function checkPrismaConnection(): Promise<boolean> {
  if (isPrismaAvailable !== null) return isPrismaAvailable;
  try {
    // Quick test query with 1s timeout
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 1500)),
    ]);
    isPrismaAvailable = true;
    console.log("Connected to PostgreSQL via Prisma successfully.");
    return true;
  } catch (err) {
    isPrismaAvailable = false;
    console.warn("PostgreSQL not accessible directly; utilizing high-fidelity dev store in prisma/dev_data.json.");
    return false;
  }
}

/**
 * Unified Database Access Object
 * Automatically uses Prisma if PostgreSQL is available, or seamless local persistence if not.
 */
export const db = {
  async isPrismaConnected(): Promise<boolean> {
    return checkPrismaConnection();
  },

  // USERS
  user: {
    async findUnique({ where }: { where: { email?: string; id?: string } }) {
      if (await checkPrismaConnection()) {
        try {
          return await (prisma.user.findUnique as any)({ where });
        } catch (e) {
          console.error("Prisma error in user.findUnique:", e);
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
      if (await checkPrismaConnection()) {
        try {
          return await prisma.user.create({ data });
        } catch (e) {
          console.error("Prisma error in user.create:", e);
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
      if (await checkPrismaConnection()) {
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
          console.error("Prisma error in project.findMany:", e);
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
      if (await checkPrismaConnection()) {
        try {
          return await prisma.project.findUnique({
            where,
            include: include || {
              assets: {
                orderBy: { createdAt: "desc" },
              },
              _count: { select: { assets: true } },
            },
          });
        } catch (e) {
          console.error("Prisma error in project.findUnique:", e);
        }
      }
      const data = loadLocalData();
      const project = data.projects.find((p) => p.id === where.id);
      if (!project) return null;

      const projectAssets = data.assets
        .filter((a) => a.projectId === where.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        ...project,
        assets: projectAssets,
        _count: { assets: projectAssets.length },
      };
    },

    async create({ data }: { data: any }) {
      if (await checkPrismaConnection()) {
        try {
          return await prisma.project.create({ data });
        } catch (e) {
          console.error("Prisma error in project.create:", e);
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
  },

  // MEDIA ASSETS
  mediaAsset: {
    async findMany({
      where = {},
      orderBy = { createdAt: "desc" },
    }: {
      where?: {
        projectId?: string;
        manualCategory?: string;
        capturedAt?: { gte?: Date | string; lte?: Date | string };
        createdAt?: { gte?: Date | string; lte?: Date | string };
      };
      orderBy?: { createdAt?: "asc" | "desc" };
    } = {}) {
      if (await checkPrismaConnection()) {
        try {
          return await prisma.mediaAsset.findMany({
            where: where as any,
            orderBy: orderBy as any,
          });
        } catch (e) {
          console.error("Prisma error in mediaAsset.findMany:", e);
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

      return results;
    },

    async findUnique({ where }: { where: { id?: string; cloudinaryPublicId?: string } }) {
      if (await checkPrismaConnection()) {
        try {
          return await (prisma.mediaAsset.findUnique as any)({ where });
        } catch (e) {
          console.error("Prisma error in mediaAsset.findUnique:", e);
        }
      }
      const data = loadLocalData();
      return (
        data.assets.find(
          (a) =>
            (where.id && a.id === where.id) ||
            (where.cloudinaryPublicId && a.cloudinaryPublicId === where.cloudinaryPublicId)
        ) || null
      );
    },

    async create({ data }: { data: any }) {
      if (await checkPrismaConnection()) {
        try {
          return await prisma.mediaAsset.create({ data });
        } catch (e) {
          console.error("Prisma error in mediaAsset.create:", e);
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      current.assets.unshift(newAsset);
      saveLocalData(current);
      return newAsset;
    },

    async update({ where, data }: { where: { id: string }; data: any }) {
      if (await checkPrismaConnection()) {
        try {
          return await prisma.mediaAsset.update({ where, data });
        } catch (e) {
          console.error("Prisma error in mediaAsset.update:", e);
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
        updatedAt: new Date().toISOString(),
      };
      current.assets[index] = updated;
      saveLocalData(current);
      return updated;
    },

    async delete({ where }: { where: { id: string } }) {
      if (await checkPrismaConnection()) {
        try {
          return await prisma.mediaAsset.delete({ where });
        } catch (e) {
          console.error("Prisma error in mediaAsset.delete:", e);
        }
      }
      const current = loadLocalData();
      const asset = current.assets.find((a) => a.id === where.id);
      if (!asset) throw new Error("Asset not found");

      current.assets = current.assets.filter((a) => a.id !== where.id);
      saveLocalData(current);
      return asset;
    },
  },
};
