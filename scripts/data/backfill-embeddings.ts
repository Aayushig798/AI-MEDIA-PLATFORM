import fs from "fs";
import path from "path";

const envPath = [".env.local", ".env"].map((f) => path.join(process.cwd(), f)).find((f) => fs.existsSync(f)) ?? path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
}

import { PrismaClient } from "@prisma/client";
import { generateEmbeddingForAsset } from "../../lib/ai/embeddings";

const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.mediaAsset.findMany();
  console.log(`Found ${assets.length} assets in PostgreSQL`);
  for (const asset of assets) {
    console.log(`Generating embedding for asset ${asset.id} (${asset.cloudinaryPublicId})...`);
    await generateEmbeddingForAsset(asset.id);
  }

  const count = await prisma.$queryRawUnsafe<any[]>('SELECT count(*) as count FROM "MediaEmbedding"');
  console.log("Total MediaEmbedding rows now in PostgreSQL:", count[0]?.count);

  const sample = await prisma.$queryRawUnsafe<any[]>('SELECT id, "mediaAssetId", "modelVersion", "createdAt" FROM "MediaEmbedding"');
  console.log("MediaEmbedding records:", sample);
}

main().catch(console.error).finally(() => prisma.$disconnect());
