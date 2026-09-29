import { db } from "@/lib/db";
import { embedQueryText } from "@/lib/ai/embeddings";

export interface SearchFilters {
  projectId?: string;
  category?: string;       // AI Domain Category (e.g. Environmental, Community, Disaster Response, etc.)
  aiCategory?: string;     // Alias for AI Domain Category
  manualCategory?: string; // Manual category entered during upload
  from?: string;
  to?: string;
  limit?: number;
  minSimilarity?: number;  // Optional threshold (defaults to 0.10)
}

export interface SearchResultItem {
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
  capturedAt: Date | string | null;
  uploadedBy: string;
  exifLat: number | null;
  exifLng: number | null;
  aiProcessingStatus: string;
  createdAt: Date | string;
  distance: number;
  similarity: number;
  aiTags: Array<{ id: string; label: string; confidence: number; source: string }>;
  categories: string[];
}

/**
 * Calculates lexical/keyword match score between query and asset metadata
 */
function computeLexicalScore(
  query: string,
  asset: {
    manualCategory?: string | null;
    manualLocation?: string | null;
    manualNotes?: string | null;
    categories: string[];
    aiTags: Array<{ label: string; confidence: number }>;
  }
): number {
  if (!query) return 0;
  const qClean = query.toLowerCase().trim();
  const queryTokens = qClean.split(/[\s,.;:!?"'()\[\]{}_\-\/]+/).filter((t) => t.length > 1);
  if (queryTokens.length === 0) return 0;

  let score = 0;
  const tagLabels = (asset.aiTags || []).map((t) => ({
    label: t.label.toLowerCase(),
    confidence: t.confidence || 0.8,
  }));
  const domainLower = (asset.categories || []).map((c) => c.toLowerCase());
  const notesLower = (asset.manualNotes || "").toLowerCase();
  const locationLower = (asset.manualLocation || "").toLowerCase();

  for (const token of queryTokens) {
    // 1. Tag match (high weight)
    const matchingTag = tagLabels.find(
      (t) => t.label === token || t.label.includes(token) || token.includes(t.label)
    );
    if (matchingTag) {
      score += 0.40 * matchingTag.confidence;
    }

    // 2. Domain category match
    if (domainLower.some((d) => d.includes(token) || token.includes(d))) {
      score += 0.35;
    }

    // 3. Location match
    if (locationLower && (locationLower.includes(token) || token.includes(locationLower))) {
      score += 0.30;
    }

    // 4. Notes match
    if (notesLower && notesLower.includes(token)) {
      score += 0.25;
    }
  }

  // Exact phrase match bonus
  const fullText = `${domainLower.join(" ")} ${tagLabels.map((t) => t.label).join(" ")} ${notesLower} ${locationLower}`;
  if (fullText.includes(qClean)) {
    score += 0.35;
  }

  return Math.min(1.0, score);
}

/**
 * Combines vector cosine similarity with lexical keyword matching
 * and filters out irrelevant assets with no semantic or lexical overlap.
 */
export async function searchAssets(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResultItem[]> {
  const trimmed = (query || "").trim();
  const limit = filters.limit || 24;
  const minThreshold = filters.minSimilarity ?? 0.12;

  const projectId = filters.projectId && filters.projectId !== "ALL" ? filters.projectId : null;
  // AI Domain Category takes priority (aligned with Project Gallery AI Domain)
  const aiDomainCategory =
    (filters.aiCategory && filters.aiCategory !== "ALL" ? filters.aiCategory : null) ||
    (filters.category && filters.category !== "ALL" ? filters.category : null);
  const manualCategory =
    filters.manualCategory && filters.manualCategory !== "ALL" ? filters.manualCategory : null;
  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to) : null;

  try {
    // Case A: Query is empty — structured filter browsing (Project, Domain, Dates)
    if (!trimmed) {
      const rawRows = await db.$queryRawUnsafe<any[]>(
        `SELECT ma.*, 0.0 AS distance
         FROM "MediaAsset" ma
         WHERE ($1::text IS NULL OR ma."projectId" = $1)
           AND (
             $2::text IS NULL 
             OR EXISTS (
               SELECT 1 
               FROM "MediaAssetCategory" mac 
               JOIN "Category" c ON c.id = mac."categoryId" 
               WHERE mac."mediaAssetId" = ma.id 
                 AND c.name ILIKE $2
             )
           )
           AND ($3::text IS NULL OR ma."manualCategory" ILIKE $3)
           AND ($4::timestamp IS NULL OR COALESCE(ma."capturedAt", ma."createdAt") >= $4)
           AND ($5::timestamp IS NULL OR COALESCE(ma."capturedAt", ma."createdAt") <= $5)
         ORDER BY COALESCE(ma."capturedAt", ma."createdAt") DESC
         LIMIT $6`,
        projectId,
        aiDomainCategory,
        manualCategory,
        fromDate,
        toDate,
        limit
      );

      const assetIds = rawRows.map((r) => r.id);
      const allTags = await db.aiTag.findMany({
        where: { mediaAssetId: { in: assetIds } as any },
        orderBy: { confidence: "desc" },
      });
      const allCategories = await db.mediaAssetCategory.findMany({
        where: { mediaAssetId: { in: assetIds } as any },
        include: { category: true },
      });

      return rawRows.map((row) => {
        const tags = allTags.filter((t: any) => t.mediaAssetId === row.id);
        const cats = allCategories
          .filter((c: any) => c.mediaAssetId === row.id)
          .map((c: any) => c.category?.name || c.name)
          .filter(Boolean);

        return {
          id: row.id,
          projectId: row.projectId,
          cloudinaryPublicId: row.cloudinaryPublicId,
          secureUrl: row.secureUrl,
          resourceType: row.resourceType,
          format: row.format,
          bytes: row.bytes,
          width: row.width,
          height: row.height,
          manualCategory: row.manualCategory,
          manualLocation: row.manualLocation,
          manualNotes: row.manualNotes,
          capturedAt: row.capturedAt,
          uploadedBy: row.uploadedBy,
          exifLat: row.exifLat,
          exifLng: row.exifLng,
          aiProcessingStatus: row.aiProcessingStatus,
          createdAt: row.createdAt,
          distance: 0,
          similarity: 1.0,
          aiTags: tags,
          categories: cats,
        };
      });
    }

    // Case B: Query is provided — dense vector embedding + lexical hybrid ranking
    const queryVector = await embedQueryText(trimmed);
    const vectorStr = `[${queryVector.join(",")}]`;

    // 1. Run pgvector cosine distance query with AI Domain Category filtering
    const rawRows = await db.$queryRawUnsafe<any[]>(
      `SELECT 
         ma.*, 
         (me.embedding <=> $1::vector) AS distance
       FROM "MediaEmbedding" me
       JOIN "MediaAsset" ma ON ma.id = me."mediaAssetId"
       WHERE ($2::text IS NULL OR ma."projectId" = $2)
         AND (
           $3::text IS NULL 
           OR EXISTS (
             SELECT 1 
             FROM "MediaAssetCategory" mac 
             JOIN "Category" c ON c.id = mac."categoryId" 
             WHERE mac."mediaAssetId" = ma.id 
               AND c.name ILIKE $3
           )
         )
         AND ($4::text IS NULL OR ma."manualCategory" ILIKE $4)
         AND ($5::timestamp IS NULL OR COALESCE(ma."capturedAt", ma."createdAt") >= $5)
         AND ($6::timestamp IS NULL OR COALESCE(ma."capturedAt", ma."createdAt") <= $6)
       ORDER BY distance ASC
       LIMIT $7`,
      vectorStr,
      projectId,
      aiDomainCategory,
      manualCategory,
      fromDate,
      toDate,
      Math.max(limit * 2, 40) // Fetch broader candidate pool for hybrid re-ranking
    );

    if (rawRows && rawRows.length > 0) {
      const assetIds = rawRows.map((r) => r.id);
      const allTags = await db.aiTag.findMany({
        where: { mediaAssetId: { in: assetIds } as any },
        orderBy: { confidence: "desc" },
      });
      const allCategories = await db.mediaAssetCategory.findMany({
        where: { mediaAssetId: { in: assetIds } as any },
        include: { category: true },
      });

      const scoredResults = rawRows
        .map((row) => {
          const rawDist = typeof row.distance === "number" ? row.distance : 1.0;
          // In pgvector unit vectors, dist = 1 - cos(theta)
          // Vector similarity: positive cosine correlation
          const vectorSim = Math.max(0, 1 - rawDist);

          const tags = allTags.filter((t: any) => t.mediaAssetId === row.id);
          const cats = allCategories
            .filter((c: any) => c.mediaAssetId === row.id)
            .map((c: any) => c.category?.name || c.name)
            .filter(Boolean);

          const lexicalSim = computeLexicalScore(trimmed, {
            manualCategory: row.manualCategory,
            manualLocation: row.manualLocation,
            manualNotes: row.manualNotes,
            categories: cats,
            aiTags: tags,
          });

          // Hybrid score fusion:
          // If keywords match, boost score; if vector matches, combine both
          let finalSimilarity = 0;
          if (lexicalSim > 0 && vectorSim > 0) {
            finalSimilarity = Math.min(
              0.99,
              Math.max(lexicalSim, vectorSim) * 0.65 + Math.min(lexicalSim, vectorSim) * 0.35 + 0.05
            );
          } else if (lexicalSim > 0) {
            finalSimilarity = Math.min(0.95, lexicalSim);
          } else if (vectorSim > 0.05) {
            finalSimilarity = vectorSim;
          } else {
            finalSimilarity = 0;
          }

          return {
            id: row.id,
            projectId: row.projectId,
            cloudinaryPublicId: row.cloudinaryPublicId,
            secureUrl: row.secureUrl,
            resourceType: row.resourceType,
            format: row.format,
            bytes: row.bytes,
            width: row.width,
            height: row.height,
            manualCategory: row.manualCategory,
            manualLocation: row.manualLocation,
            manualNotes: row.manualNotes,
            capturedAt: row.capturedAt,
            uploadedBy: row.uploadedBy,
            exifLat: row.exifLat,
            exifLng: row.exifLng,
            aiProcessingStatus: row.aiProcessingStatus,
            createdAt: row.createdAt,
            distance: Math.round(rawDist * 1000) / 1000,
            similarity: Math.round(finalSimilarity * 1000) / 1000,
            aiTags: tags,
            categories: cats,
          };
        })
        // CRITICAL FILTER: Exclude completely irrelevant assets that have zero match
        .filter((item) => item.similarity >= minThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return scoredResults;
    }

    // 2. Keyword fallback query if embeddings are not found
    console.log("[Search] No pgvector candidate rows, running keyword fallback query");
    const fallbackAssets = await db.mediaAsset.findMany({
      where: {
        projectId: projectId || undefined,
        manualCategory: manualCategory || undefined,
      },
      include: {
        aiTags: { orderBy: { confidence: "desc" } },
        categories: { include: { category: true } },
      },
    });

    const fallbackScored = fallbackAssets
      .map((asset: any) => {
        const cats = (asset.categories || [])
          .map((c: any) => c.category?.name || c.name)
          .filter(Boolean);

        // If domain filter is active, check domain
        if (aiDomainCategory && !cats.some((c: string) => c.toLowerCase() === aiDomainCategory.toLowerCase())) {
          return null;
        }

        const lexicalSim = computeLexicalScore(trimmed, {
          manualCategory: asset.manualCategory,
          manualLocation: asset.manualLocation,
          manualNotes: asset.manualNotes,
          categories: cats,
          aiTags: asset.aiTags || [],
        });

        if (lexicalSim < minThreshold) return null;

        return {
          ...asset,
          distance: Math.round((1 - lexicalSim) * 1000) / 1000,
          similarity: Math.round(lexicalSim * 1000) / 1000,
          categories: cats,
        };
      })
      .filter(Boolean) as SearchResultItem[];

    return fallbackScored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error: any) {
    console.error("[Search Error] Vector search failed:", error);
    throw error;
  }
}
