import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { generateImageCaption } from "@/lib/ai/captioning";
import { getOptimizedVisionUrl } from "@/lib/cloudinary-url";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit/logEvent";

// Groq (used for chat/vision elsewhere) has no embeddings endpoint. OPENAI_API_KEY is
// now optional and used ONLY for embeddings; without it the deterministic hashed
// embedding below is used (keyword-like matching, not true semantic similarity).
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Generates a deterministic normalized 1536-dimensional embedding vector
 * from text tokens and n-grams. Used when OPENAI_API_KEY is not configured
 * so pgvector operations, tests, and vector similarity continue to function seamlessly.
 */
export function generateDeterministicEmbedding(text: string, dimensions = 1536): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().trim();
  if (!normalized) {
    vector[0] = 1;
    return vector;
  }

  // Tokenize words and subwords
  const words = normalized.split(/[\s,.;:!?"'()\[\]{}_\-\/]+/).filter(Boolean);
  
  // Hash helper
  function hashString(str: string, seed: number): number {
    let h = seed ^ 0xdeadbeef;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
    }
    return (h ^ (h >>> 16)) >>> 0;
  }

  // Feature hashing for unigrams and bigrams
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Hash individual word
    const h1 = hashString(word, 0);
    const idx1 = h1 % dimensions;
    const sign1 = (hashString(word, 1) % 2 === 0) ? 1 : -1;
    vector[idx1] += sign1 * 1.5;

    // Substrings / stems
    if (word.length > 3) {
      for (let j = 0; j <= word.length - 3; j++) {
        const trigram = word.substring(j, j + 3);
        const ht = hashString(trigram, 42);
        const idxt = ht % dimensions;
        const signt = (hashString(trigram, 43) % 2 === 0) ? 1 : -1;
        vector[idxt] += signt * 0.4;
      }
    }

    // Bigram
    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      const h2 = hashString(bigram, 7);
      const idx2 = h2 % dimensions;
      const sign2 = (hashString(bigram, 8) % 2 === 0) ? 1 : -1;
      vector[idx2] += sign2 * 2.0;
    }
  }

  // Compute L2 norm and normalize to unit vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Math.round((vector[i] / norm) * 100000) / 100000;
    }
  } else {
    vector[0] = 1;
  }

  return vector;
}

/**
 * Embeds query text using OpenAI text-embedding-3-small (or deterministic fallback)
 */
export async function embedQueryText(query: string): Promise<number[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return new Array(1536).fill(0);
  }

  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const res = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: trimmed,
      });
      return res.data[0].embedding;
    } catch (err: any) {
      console.warn("[Embeddings] OpenAI query embedding failed, falling back to deterministic:", err.message);
    }
  }

  return generateDeterministicEmbedding(trimmed, 1536);
}

/**
 * Builds text summary for an asset from tags, categories, location, notes
 * and persists the embedding into the MediaEmbedding table in pgvector.
 */
/**
 * One-sentence visual description for the embedding text: reuse the Cloudinary
 * AI Vision description from the integrity run when present, else caption it.
 */
async function describeAsset(assetId: string, secureUrl: string, resourceType: string): Promise<string | null> {
  try {
    const integrity = await prisma.assetIntegrity.findUnique({ where: { assetId }, select: { checks: true } });
    const claim = ((integrity?.checks as any[]) ?? []).find((c) => c?.id === "claim");
    const description = claim?.details?.description;
    if (typeof description === "string" && description.trim()) return `Visual description: ${description.trim()}`;
  } catch {
    // file-store mode: no integrity table
  }
  if (resourceType !== "image") return null;
  const caption = await generateImageCaption(getOptimizedVisionUrl(secureUrl));
  return caption ? `Visual description: ${caption}` : null;
}

export async function generateEmbeddingForAsset(assetId: string): Promise<number[] | null> {
  try {
    const asset = await db.mediaAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      console.warn(`[Embeddings] Asset ${assetId} not found`);
      return null;
    }

    const tags = await db.aiTag.findMany({ where: { mediaAssetId: assetId } });
    const categories = await db.mediaAssetCategory.findMany({
      where: { mediaAssetId: assetId },
      include: { category: true },
    });

    const categoryNames = categories.map((c: any) => c.category?.name || c.name).filter(Boolean);
    const primaryCat = categoryNames[0] || asset.manualCategory || "Uncategorized";
    const tagLabels = tags.map((t) => t.label).join(", ");
    const topTagLabels = tags.slice(0, 5).map((t) => t.label).join(" ");

    const textParts = [
      `AI Domain Category: ${primaryCat}.`,
      `Assigned Domain: ${primaryCat}.`,
      tagLabels ? `Visual evidence tags: ${tagLabels}.` : "",
      topTagLabels ? `Core signals: ${topTagLabels}.` : "",
      asset.manualCategory && asset.manualCategory !== primaryCat ? `Manual category: ${asset.manualCategory}.` : "",
      asset.manualLocation ? `Location: ${asset.manualLocation}.` : "",
      asset.manualNotes ? `Field notes: ${asset.manualNotes}.` : "",
      asset.resourceType ? `Media type: ${asset.resourceType}.` : "",
      (await describeAsset(asset.id, asset.secureUrl, asset.resourceType)) ?? "",
    ];
    const textSummary = textParts.filter(Boolean).join(" ");

    let vector: number[];
    let modelVersion = "text-embedding-3-small";

    if (openai && process.env.OPENAI_API_KEY) {
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: textSummary,
        });
        vector = response.data[0].embedding;
      } catch (err: any) {
        console.warn(`[Embeddings] OpenAI failed for asset ${assetId}:`, err.message);
        vector = generateDeterministicEmbedding(textSummary, 1536);
        modelVersion = "deterministic-fallback-1536";
      }
    } else {
      vector = generateDeterministicEmbedding(textSummary, 1536);
      modelVersion = "deterministic-fallback-1536";
    }

    // Persist into pgvector MediaEmbedding table
    await db.$executeRawUnsafe(
      `INSERT INTO "MediaEmbedding" (id, "mediaAssetId", embedding, "modelVersion", "createdAt")
       VALUES (gen_random_uuid(), $1, $2::vector, $3, now())
       ON CONFLICT ("mediaAssetId") DO UPDATE SET embedding = $2::vector, "modelVersion" = $3`,
      assetId,
      `[${vector.join(",")}]`,
      modelVersion
    );

    console.log(`[Embeddings] Successfully generated & saved embedding for asset ${assetId} (${modelVersion})`);

    await logEvent(
      assetId,
      "embedded",
      { model: modelVersion, dimensions: 1536 },
      "system-ai"
    );

    return vector;
  } catch (error: any) {
    console.error(`[Embeddings Error] Failed to generate embedding for asset ${assetId}:`, error);
    return null;
  }
}
