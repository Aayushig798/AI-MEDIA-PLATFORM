import { PrismaClient } from "@prisma/client";

// Prisma Client singleton so Next.js hot-reloading doesn't open a new pool per edit.
// The Integrity Engine (ledger ordering, pHash matching in SQL) needs real
// PostgreSQL, so there is intentionally no file-backed fallback.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
