-- Run after `prisma db push`: approximate nearest-neighbour index for cosine search (pgvector >= 0.5).
CREATE INDEX IF NOT EXISTS "MediaEmbedding_embedding_hnsw" ON "MediaEmbedding" USING hnsw (embedding vector_cosine_ops);
